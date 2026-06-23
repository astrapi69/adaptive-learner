"""Launcher Actions - the single business-logic layer.

Every launcher operation is an isolated action here. The GUI (``ui.py``)
and the CLI (``__main__.py``) call ONLY these functions; this module
imports NO tkinter and contains no GUI code, so every action is unit
testable with pytest without a display.

Contract for every action:

- Takes plain parameters (``str`` / ``int`` / ``Path``).
- Returns ``(success: bool, message: str)`` (a few return richer tuples
  where documented, e.g. :func:`find_free_port`).
- VERIFIES its result rather than blindly reporting success (e.g.
  uninstall confirms the containers are actually gone).

Long-running actions (:func:`install`, :func:`start`) accept an optional
``on_step(label: str)`` progress callback, and :func:`install` also takes
an ``on_output(line: str)`` callback that streams the Docker build's output
line-by-line as it happens. Both are plain Python callables - the GUI
passes ones that marshal onto the Tk thread, but the action neither knows
nor cares.
"""

from __future__ import annotations

import json
import logging
import shutil
import socket
import subprocess
import threading
import urllib.request
import webbrowser
from collections.abc import Callable
from pathlib import Path

from adaptive_learner_launcher import __version__, manifest

logger = logging.getLogger("adaptive_learner_launcher.actions")

DEFAULT_PROJECT = "adaptive-learner"
DEFAULT_PORT = 8501
HEALTH_PATH = "/api/health"
MIN_PORT = 1024
MAX_PORT = 65535

# Container-name filters: the current ``adaptive-learner`` project plus the
# legacy ``adaptive_learner`` (underscore) names a faulty older launcher may
# have left behind. Multiple ``--filter name=`` are OR'd by docker.
_NAME_FILTERS = ("name=adaptive-learner", "name=adaptive_learner")

ProgressFn = Callable[[str], None]
# Per-line output callback for a streamed command (e.g. the Docker build).
OutputFn = Callable[[str], None]


def _run(cmd: list[str], *, timeout: float = 15.0, cwd: Path | None = None) -> subprocess.CompletedProcess:
    """Run a docker command, capturing output. Logs the call for --debug."""
    logger.debug("exec: %s (cwd=%s, timeout=%ss)", " ".join(cmd), cwd, timeout)
    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=timeout,
        cwd=str(cwd) if cwd else None,
    )
    logger.debug("exit=%s stdout=%r stderr=%r", result.returncode,
                 (result.stdout or "")[-1500:], (result.stderr or "")[-1500:])
    return result


def _notify(on_step: ProgressFn | None, label: str) -> None:
    if on_step is not None:
        try:
            on_step(label)
        except Exception as exc:  # noqa: BLE001 - progress UI must never break an action
            logger.debug("progress callback failed: %s", exc)


# --- Docker + state -------------------------------------------------------

def docker_installed() -> tuple[bool, str]:
    """Return (installed, message). True if the ``docker`` binary exists.

    Distinct from :func:`check_docker`: this only checks the CLI is
    present (``docker --version``), not whether the daemon is running -
    so callers can tell "not installed" from "installed but stopped".
    """
    try:
        result = _run(["docker", "--version"], timeout=10.0)
    except FileNotFoundError:
        return False, "Docker ist nicht installiert (docker nicht im PATH)."
    except subprocess.TimeoutExpired:
        return False, "Docker antwortet nicht."
    if result.returncode != 0:
        return False, (result.stderr or "").strip() or "docker --version schlug fehl."
    return True, (result.stdout or "").strip() or "Docker ist installiert."


def check_docker() -> tuple[bool, str]:
    """Return (running, message). True only when the daemon is reachable.

    Covers the installed-check too: FileNotFoundError -> not installed;
    a non-zero ``docker info`` -> installed but the daemon is not started.
    """
    try:
        result = _run(["docker", "info"], timeout=10.0)
    except FileNotFoundError:
        return False, "Docker ist nicht installiert (docker nicht im PATH)."
    except subprocess.TimeoutExpired:
        return False, "Docker antwortet nicht (Docker Desktop startet evtl. noch)."
    if result.returncode != 0:
        return False, "Docker Desktop ist nicht gestartet."
    return True, "Docker laeuft."


def _project_container_ids(*, running_only: bool) -> list[str]:
    cmd = ["docker", "ps", "-q"] if running_only else ["docker", "ps", "-aq"]
    for flt in _NAME_FILTERS:
        cmd += ["--filter", flt]
    try:
        result = _run(cmd, timeout=15.0)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    return [cid for cid in (result.stdout or "").strip().splitlines() if cid]


def get_state(project: str = DEFAULT_PROJECT) -> str:
    """Return 'no_docker' | 'not_installed' | 'running' | 'stopped'."""
    docker_ok, _ = check_docker()
    if not docker_ok:
        return "no_docker"
    if _project_container_ids(running_only=True):
        return "running"
    if _project_container_ids(running_only=False):
        return "stopped"
    return "not_installed"


# --- Ports ----------------------------------------------------------------

def check_port(port: int, *, host: str = "") -> tuple[bool, str]:
    """Return (free, message). Validates the range, then probes by BIND.

    Bind (not connect) is the correct check for "can docker publish this
    port": Docker publishes by binding all interfaces, so we bind the same
    way. ``SO_REUSEADDR`` is intentionally not set so a live conflict
    surfaces instead of being masked.

    On Windows a plain bind probe is too permissive - it succeeds even when
    another socket already holds the port (and a ``0.0.0.0`` bind does not
    conflict with a ``127.0.0.1`` listener), so an occupied port would read
    as free and the conflict detection would silently fail (#990). We set
    ``SO_EXCLUSIVEADDRUSE`` there, the Windows-only option that makes the
    bind fail on any overlapping bind. It does not exist on Linux/macOS, so
    those keep the plain-bind behaviour.
    """
    valid, reason = _validate_port(port)
    if not valid:
        return False, reason
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):  # Windows only
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        sock.bind((host, port))
    except OSError:
        return False, f"Port {port} ist belegt."
    finally:
        sock.close()
    return True, f"Port {port} ist frei."


def find_free_port(start: int, *, max_tries: int = 100) -> tuple[bool, int, str]:
    """Return (found, port, message), scanning up to ``max_tries`` ports
    from ``start``. Returns ``(False, 0, ...)`` on an invalid start or
    when no free port is found."""
    valid, _ = _validate_port(start)
    if not valid:
        return False, 0, f"Ungueltiger Start-Port: {start}."
    last = min(start + max_tries - 1, MAX_PORT)
    for candidate in range(start, last + 1):
        free, _ = check_port(candidate)
        if free:
            return True, candidate, f"Freier Port gefunden: {candidate}."
    return False, 0, "Kein freier Port gefunden."


# --- Lifecycle (install / start / stop / uninstall) -----------------------

def _compose(project: str, compose_file: str, *args: str, timeout: float) -> subprocess.CompletedProcess:
    return _run(
        ["docker", "compose", "-p", project, "-f", compose_file, *args],
        timeout=timeout,
    )


def _stream(
    cmd: list[str],
    *,
    on_output: OutputFn | None = None,
    timeout: float,
    tail_lines: int = 15,
    keep: int = 400,
) -> tuple[int, str]:
    """Run ``cmd``, streaming combined stdout+stderr line-by-line to
    ``on_output`` as each line arrives. Returns ``(returncode, tail)`` where
    ``tail`` is the last ``tail_lines`` lines (for an error message).

    Unlike :func:`_run` (which blocks until the process exits and only then
    returns the whole output), this surfaces progress live - the Docker
    build prints for minutes, and the user must see it move (#992). A
    watchdog timer kills the process after ``timeout`` and the call then
    raises :class:`subprocess.TimeoutExpired`, matching ``_run``'s contract.
    Tk-free: ``on_output`` is a plain callable the GUI marshals onto its
    own thread.
    """
    logger.debug("stream: %s (timeout=%ss)", " ".join(cmd), timeout)
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1,
    )
    lines: list[str] = []
    killed = {"v": False}

    def _kill() -> None:
        killed["v"] = True
        proc.kill()

    timer = threading.Timer(timeout, _kill)
    timer.start()
    try:
        assert proc.stdout is not None
        for raw in proc.stdout:
            line = raw.rstrip("\n")
            lines.append(line)
            if len(lines) > keep:
                lines.pop(0)
            if on_output is not None:
                try:
                    on_output(line)
                except Exception as exc:  # noqa: BLE001 - output UI must never break the build
                    logger.debug("output callback failed: %s", exc)
        proc.wait()
    finally:
        timer.cancel()
    if killed["v"]:
        raise subprocess.TimeoutExpired(cmd, timeout)
    return proc.returncode, "\n".join(lines[-tail_lines:])


def _stream_compose(
    project: str, compose_file: str, *args: str,
    on_output: OutputFn | None = None, timeout: float,
) -> tuple[int, str]:
    """Stream a ``docker compose`` subcommand (see :func:`_stream`)."""
    return _stream(
        ["docker", "compose", "-p", project, "-f", compose_file, *args],
        on_output=on_output, timeout=timeout,
    )


_DOCKER_UNAVAILABLE = "Docker ist nicht verfuegbar (nicht gestartet)."


def install(compose_file: str, project: str = DEFAULT_PROJECT, port: int = DEFAULT_PORT,
            *, on_step: ProgressFn | None = None,
            on_output: OutputFn | None = None) -> tuple[bool, str]:
    """Build + start the stack, then VERIFY it is running and healthy.

    Guards (each returns ``(False, ...)``): invalid port, Docker down,
    missing compose file, occupied port. If the app is already running it
    returns ``(True, "Bereits installiert")``.

    Emits step labels through ``on_step`` and streams the Docker build's
    output line-by-line through ``on_output`` (the first build takes
    minutes, so the user must see it move - #992). Both callbacks are
    optional and Tk-free; the GUI marshals them onto its own thread.
    """
    valid, reason = _validate_port(port)
    if not valid:
        return False, reason
    _notify(on_step, "Docker pruefen...")
    docker_ok, _ = check_docker()
    if not docker_ok:
        return False, _DOCKER_UNAVAILABLE
    if get_state(project) == "running":
        return True, "App ist bereits installiert und laeuft."
    if not Path(compose_file).is_file():
        return False, f"Compose-Datei nicht gefunden: {compose_file}"
    port_free, port_msg = check_port(port)
    if not port_free:
        return False, port_msg
    _notify(on_step, "Docker laeuft ✓")

    _notify(on_step, "Image bauen... (kann beim ersten Mal einige Minuten dauern)")
    try:
        build_rc, build_tail = _stream_compose(
            project, compose_file, "build", on_output=on_output, timeout=900.0)
    except FileNotFoundError:
        return False, _DOCKER_UNAVAILABLE
    except subprocess.TimeoutExpired:
        return False, "Docker-Build hat das Zeitlimit (15 Min) ueberschritten."
    if build_rc != 0:
        return False, f"Docker-Build fehlgeschlagen:\n{build_tail}"
    _notify(on_step, "Image gebaut ✓")

    _notify(on_step, "Container starten...")
    try:
        up_rc, up_tail = _stream_compose(
            project, compose_file, "up", "-d", on_output=on_output, timeout=180.0)
    except FileNotFoundError:
        return False, _DOCKER_UNAVAILABLE
    except subprocess.TimeoutExpired:
        return False, "Start hat das Zeitlimit ueberschritten."
    if up_rc != 0:
        return False, f"Start fehlgeschlagen:\n{up_tail}"
    _notify(on_step, "Container gestartet ✓")

    _notify(on_step, "Bereitschaft pruefen...")
    if get_state(project) != "running":
        return False, "Container wurde gebaut, laeuft aber nicht."
    healthy, health_msg = health_check(port, HEALTH_PATH, timeout=120)
    if not healthy:
        return False, f"Installiert, aber die App ist nicht erreichbar: {health_msg}"
    _notify(on_step, "Bereitschaft bestaetigt ✓")
    _record_install_manifest(project, compose_file, port, action="install")
    return True, "Installation abgeschlossen. App ist bereit."


def ensure_installed(install_dir: Path, project: str = DEFAULT_PROJECT,
                     port: int = DEFAULT_PORT, *,
                     on_step: ProgressFn | None = None,
                     on_output: OutputFn | None = None) -> tuple[bool, str]:
    """Single install entry point for the persistent window (#1045).

    When ``install_dir`` is NOT a valid repo (the frozen-binary case: no local
    checkout, no compose file), DOWNLOAD the release into it + create the
    ``.env`` first, streaming progress to the GUI log; then install. When a
    valid repo is already present (source checkout or a prior download), this
    is just :func:`install`. ONE code path for source checkouts and frozen
    binaries alike - the window stays open throughout.
    """
    from adaptive_learner_launcher import config, installer

    compose_file = install_dir / config.COMPOSE_FILENAME
    if not config.is_valid_repo(install_dir):
        docker_ok, _ = check_docker()
        if not docker_ok:
            return False, _DOCKER_UNAVAILABLE
        _notify(on_step, "Release wird heruntergeladen...")
        try:
            ok, detail = installer.download_release(install_dir)
        except Exception as exc:  # noqa: BLE001 - surface as a friendly result
            return False, f"Download fehlgeschlagen: {exc}"
        if not ok:
            return False, f"Download fehlgeschlagen: {detail}"
        _notify(on_step, "Release heruntergeladen ✓")
        env_ok, env_detail = installer.create_env_file(install_dir)
        if not env_ok:
            return False, f"Konfiguration fehlgeschlagen: {env_detail}"
        _notify(on_step, "Konfiguration vorbereitet ✓")
    return install(str(compose_file), project, port, on_step=on_step, on_output=on_output)


def start(compose_file: str, project: str = DEFAULT_PROJECT,
          *, on_step: ProgressFn | None = None,
          on_output: OutputFn | None = None) -> tuple[bool, str]:
    """Start the stack via ``compose up --build -d``, then VERIFY it runs.

    Always passes ``--build`` so a ``git pull`` / code change is picked up
    automatically on the next start (#999); Docker's layer cache makes an
    UNCHANGED rebuild near-instant (a few seconds), so this is cheap. The
    build output streams live through ``on_output`` like :func:`install`
    (#992).

    ``up --build -d`` also creates the containers if they do not exist yet,
    so it works from BOTH 'stopped' (containers present) AND a removed-state
    (containers gone after ``down``, images still present). It does NOT
    refuse on 'not_installed' - that was a regression that broke the start
    flow whenever the app was installed but had no container yet (#977).
    A truly-missing compose file/images surfaces as the real compose error.
    """
    docker_ok, _ = check_docker()
    if not docker_ok:
        return False, _DOCKER_UNAVAILABLE
    if get_state(project) == "running":
        return True, "App laeuft bereits."
    _notify(on_step, "Image wird aktualisiert... (nach Code-Aenderungen einige Minuten, sonst Sekunden)")
    try:
        rc, tail = _stream_compose(
            project, compose_file, "up", "--build", "-d",
            on_output=on_output, timeout=900.0)
    except FileNotFoundError:
        return False, _DOCKER_UNAVAILABLE
    except subprocess.TimeoutExpired:
        return False, "Start hat das Zeitlimit ueberschritten."
    if rc != 0:
        return False, f"Start fehlgeschlagen:\n{tail}"
    if get_state(project) != "running":
        return False, "Start-Befehl lief, aber kein Container laeuft."
    # Start always rebuilds (#999): refresh the manifest + audit an "update".
    existing = manifest.read_manifest() or {}
    _record_install_manifest(
        project, compose_file, int(existing.get("port", DEFAULT_PORT)), action="update")
    return True, "App gestartet."


def compose_build(compose_file: str, project: str = DEFAULT_PROJECT) -> tuple[bool, str]:
    """Build images and start the stack (``up --build -d``). Granular - no
    health check or slow-start handling, so callers keep that UX. Returns
    the compose output tail on failure."""
    try:
        result = _compose(project, compose_file, "up", "--build", "-d", timeout=600.0)
    except FileNotFoundError:
        return False, _DOCKER_UNAVAILABLE
    except subprocess.TimeoutExpired:
        return False, "Docker-Build hat das Zeitlimit (10 Min) ueberschritten."
    if result.returncode != 0:
        return False, f"Docker-Build fehlgeschlagen:\n{_tail(result)}"
    return True, "gebaut und gestartet."


def stop(project: str = DEFAULT_PROJECT) -> tuple[bool, str]:
    """Stop the running containers, then VERIFY none are running.

    Uses ``docker stop`` by id so the containers REMAIN (state -> stopped),
    keeping data + images for a fast restart. Verified.
    """
    docker_ok, _ = check_docker()
    if not docker_ok:
        return False, _DOCKER_UNAVAILABLE
    state = get_state(project)
    if state == "not_installed":
        return False, "App ist nicht installiert."
    if state == "stopped":
        return True, "App war bereits gestoppt."
    running = _project_container_ids(running_only=True)
    try:
        _run(["docker", "stop", *running], timeout=60.0)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return False, f"Stoppen fehlgeschlagen: {exc}"
    if _project_container_ids(running_only=True):
        return False, "Container laeuft nach dem Stop-Befehl noch."
    return True, "App gestoppt."


def uninstall(project: str = DEFAULT_PROJECT, *, on_step: ProgressFn | None = None) -> tuple[bool, str]:
    """Force-remove containers (and images), then VERIFY they are gone.

    Removes by id (``docker rm -f``) so it works regardless of the compose
    directory, and re-lists to confirm - never claims success while a
    container survives. Volumes are PRESERVED (data survives a reinstall).

    Verbose (#1041): every container stop/remove and every image removal is a
    SEPARATE step reported through ``on_step`` with a ``✓``/``✗`` result, so
    the GUI streams the uninstall live (like install) instead of only showing
    the final "abgeschlossen" line. ``on_step`` is best-effort; a failing
    callback never breaks the uninstall.
    """
    docker_ok, _ = check_docker()
    if not docker_ok:
        return False, _DOCKER_UNAVAILABLE
    _notify(on_step, "Deinstallation gestartet...")
    containers = _project_containers(running_only=False)
    if not containers:
        _notify(on_step, "Keine Container gefunden ✓")
        # No containers, but stray images may still linger - clear them too.
        _uninstall_images(on_step)
        return True, "Nichts zu deinstallieren (kein Container vorhanden)."

    # Stop each container individually (best-effort; ``rm -f`` would also stop,
    # but the spec wants a visible per-container step).
    for cid, name in containers:
        ok, detail = _docker_op(["docker", "stop", cid], timeout=60.0)
        _notify(on_step, _step_label(f"Container '{name}' stoppen", ok, detail))

    # Remove each container individually.
    for cid, name in containers:
        ok, detail = _docker_op(["docker", "rm", "-f", cid], timeout=60.0)
        _notify(on_step, _step_label(f"Container '{name}' entfernen", ok, detail))

    remaining = _project_container_ids(running_only=False)
    if remaining:
        _notify(on_step, f"Verifizierung: {len(remaining)} Container verbleiben ✗")
        return False, f"Teilweise entfernt: {len(remaining)} Container konnte(n) nicht entfernt werden."
    _notify(on_step, "Verifizierung: keine Container gefunden ✓")

    # Best-effort image cleanup (frees disk; never blocks success).
    _uninstall_images(on_step)
    # Audit + mark the install gone so the startup cleanup scan ignores it
    # (#1043). Best-effort; never blocks the uninstall result.
    try:
        manifest.mark_uninstalled(_manifest_app_version())
    except Exception as exc:  # noqa: BLE001 - manifest is non-critical
        logger.warning("manifest mark-uninstalled failed: %s", exc)
    return True, "Deinstallation abgeschlossen. Deine Lerndaten bleiben erhalten."


def _docker_op(cmd: list[str], *, timeout: float = 60.0) -> tuple[bool, str]:
    """Run ONE docker step. Returns ``(ok, detail)`` - ``detail`` is the
    trimmed last stderr line on failure (for the ``✗ Fehler: ...`` step), or
    a short reason when docker is missing / times out. Never raises."""
    try:
        result = _run(cmd, timeout=timeout)
    except FileNotFoundError:
        return False, "Docker nicht gefunden"
    except subprocess.TimeoutExpired:
        return False, "Zeitueberschreitung"
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        return False, stderr.splitlines()[-1] if stderr else "unbekannter Fehler"
    return True, ""


def _step_label(label: str, ok: bool, detail: str) -> str:
    """Format one verbose step line: ``<label>... ✓`` or
    ``<label>... ✗ Fehler: <detail>`` (#1041)."""
    return f"{label}... ✓" if ok else f"{label}... ✗ Fehler: {detail}"


def _project_containers(*, running_only: bool) -> list[tuple[str, str]]:
    """List this project's containers as ``(id, name)`` pairs (current +
    legacy names). Empty on any docker failure - the caller treats that as
    "nothing to remove"."""
    cmd = ["docker", "ps"] if running_only else ["docker", "ps", "-a"]
    for flt in _NAME_FILTERS:
        cmd += ["--filter", flt]
    cmd += ["--format", "{{.ID}}\t{{.Names}}"]
    try:
        result = _run(cmd, timeout=15.0)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    pairs: list[tuple[str, str]] = []
    for line in (result.stdout or "").strip().splitlines():
        cid, _, name = line.partition("\t")
        if cid:
            pairs.append((cid, name or cid))
    return pairs


def _project_images() -> list[tuple[str, str]]:
    """List Adaptive Learner images as ``(id, reference)`` pairs (current +
    legacy names), de-duplicated by id. Empty on any docker failure."""
    try:
        result = _run([
            "docker", "images",
            "--filter", "reference=*adaptive-learner*",
            "--filter", "reference=*adaptive_learner*",
            "--format", "{{.ID}}\t{{.Repository}}",
        ])
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    pairs: list[tuple[str, str]] = []
    seen: set[str] = set()
    for line in (result.stdout or "").strip().splitlines():
        cid, _, ref = line.partition("\t")
        if cid and cid not in seen:
            seen.add(cid)
            pairs.append((cid, ref or cid))
    return pairs


def _uninstall_images(on_step: ProgressFn | None = None) -> None:
    """Remove each Adaptive Learner image individually, reporting a verbose
    step per image (#1041). Best-effort: a failure is logged + shown as a
    ``✗`` step but never blocks the uninstall."""
    for cid, ref in _project_images():
        ok, detail = _docker_op(["docker", "image", "rm", "--force", cid], timeout=60.0)
        _notify(on_step, _step_label(f"Image '{ref}' entfernen", ok, detail))
        if not ok:
            logger.warning("image removal failed for %s: %s", ref, detail)



def remove_images() -> tuple[bool, str]:
    """Remove all Adaptive Learner Docker images (current + legacy names)."""
    try:
        result = _run([
            "docker", "images",
            "--filter", "reference=*adaptive-learner*",
            "--filter", "reference=*adaptive_learner*",
            "-q",
        ])
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return True, "Docker nicht verfuegbar, uebersprungen."
    images = [i for i in (result.stdout or "").strip().splitlines() if i]
    if not images:
        return True, "Keine Images gefunden."
    try:
        _run(["docker", "image", "rm", "--force", *images], timeout=60.0)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return False, f"Image-Entfernung fehlgeschlagen: {exc}"
    return True, f"{len(images)} Image(s) entfernt."


def remove_volumes() -> tuple[bool, str]:
    """Remove the Adaptive Learner Docker volumes (current + legacy names).

    DESTRUCTIVE - deletes learner data. Only the cleanup/full-reset path
    calls this; the normal uninstall preserves volumes.
    """
    try:
        result = _run([
            "docker", "volume", "ls",
            "--filter", "name=adaptive-learner",
            "--filter", "name=adaptive_learner",
            "-q",
        ])
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return True, "Docker nicht verfuegbar, uebersprungen."
    volumes = [v for v in (result.stdout or "").strip().splitlines() if v]
    if not volumes:
        return True, "Keine Volumes gefunden."
    try:
        _run(["docker", "volume", "rm", *volumes], timeout=30.0)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return False, f"Volume-Entfernung fehlgeschlagen: {exc}"
    return True, f"{len(volumes)} Volume(s) entfernt."


# --- Install manifest + startup cleanup (#1042 / #1043) -------------------
#
# Broad cleanup patterns: the current + legacy app names plus the Bibliogon
# sibling, whose leftovers an older shared launcher may have created.
_CLEANUP_PATTERNS = ("adaptive-learner", "adaptive_learner", "bibliogon")


def _running_container_names() -> list[str]:
    """Names of the project's currently RUNNING containers (live install)."""
    try:
        result = _run(["docker", "ps", "--format", "{{.Names}}"] +
                      [a for flt in _NAME_FILTERS for a in ("--filter", flt)])
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    return [n for n in (result.stdout or "").strip().splitlines() if n]


def _docker_names(kind: str, patterns: tuple[str, ...]) -> list[str]:
    """List docker object names matching any of ``patterns`` (de-duplicated,
    order-stable). ``kind`` is ``"container"`` or ``"volume"``."""
    if kind == "container":
        base = ["docker", "ps", "-a", "--format", "{{.Names}}"]
    else:  # volume
        base = ["docker", "volume", "ls", "--format", "{{.Name}}"]
    found: list[str] = []
    seen: set[str] = set()
    for pat in patterns:
        try:
            result = _run([*base, "--filter", f"name={pat}"], timeout=15.0)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
        for name in (result.stdout or "").strip().splitlines():
            if name and name not in seen:
                seen.add(name)
                found.append(name)
    return found


def _image_refs(patterns: tuple[str, ...]) -> list[str]:
    """List image references (``repo:tag``) matching any of ``patterns``."""
    found: list[str] = []
    seen: set[str] = set()
    for pat in patterns:
        try:
            result = _run([
                "docker", "images", "--filter", f"reference=*{pat}*",
                "--format", "{{.Repository}}:{{.Tag}}",
            ], timeout=15.0)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
        for ref in (result.stdout or "").strip().splitlines():
            if ref and ref not in seen:
                seen.add(ref)
                found.append(ref)
    return found


def collect_installed_artifacts(project: str = DEFAULT_PROJECT) -> dict[str, list]:
    """Snapshot the docker artifacts belonging to ``project`` (#1043).

    Call AFTER a successful ``docker compose up`` to feed the install
    manifest. Returns ``{"containers": [{"name","image"}], "images":
    [repo:tag...], "volumes": [name...]}`` - empty lists on any docker failure.
    """
    containers: list[dict[str, str]] = []
    try:
        result = _run([
            "docker", "ps", "-a",
            "--filter", f"name={project}",
            "--format", "{{.Names}}\t{{.Image}}",
        ], timeout=15.0)
        for line in (result.stdout or "").strip().splitlines():
            name, _, image = line.partition("\t")
            if name:
                containers.append({"name": name, "image": image})
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return {
        "containers": containers,
        "images": _image_refs((project,)),
        "volumes": _docker_names("volume", (project,)),
    }


def find_stale_artifacts(
    project: str = DEFAULT_PROJECT,
    *,
    config_dirs: list[Path] | None = None,
) -> dict[str, list]:
    """Find STALE (leftover) artifacts to offer for cleanup at startup (#1042).

    Manifest-first (#1043): the current install manifest's recorded artifacts
    are the ACTIVE install and are EXCLUDED - only artifacts BEYOND it (old
    versions, Bibliogon, orphans) are returned. Without a manifest, the live
    install is protected by excluding currently-RUNNING containers.

    Returns ``{"containers": [name...], "images": [repo:tag...], "volumes":
    [name...], "configs": [path...]}``. The SAFETY rule: never list an
    artifact that belongs to the active install. Volumes are reported (data!)
    but the caller decides whether to act on them.
    """
    active = manifest.manifest_artifacts()
    active_containers = set(active["containers"])
    active_images = set(active["images"])
    active_volumes = set(active["volumes"])
    if not (active_containers or active_images or active_volumes):
        # No usable manifest -> protect the live install by name.
        active_containers |= set(_running_container_names())

    stale = {
        "containers": [n for n in _docker_names("container", _CLEANUP_PATTERNS)
                       if n not in active_containers],
        "images": [r for r in _image_refs(_CLEANUP_PATTERNS)
                   if r not in active_images],
        "volumes": [v for v in _docker_names("volume", _CLEANUP_PATTERNS)
                    if v not in active_volumes],
        "configs": _stale_config_dirs(config_dirs, active.get("configs", [])),
    }
    return stale


def _stale_config_dirs(
    candidates: list[Path] | None, active_configs: list[str]
) -> list[str]:
    """Existing legacy config dirs not referenced by the active manifest."""
    active = {str(Path(c).expanduser()) for c in active_configs}
    out: list[str] = []
    search = candidates if candidates is not None else _legacy_config_dirs()
    for path in search:
        resolved = path.expanduser()
        if resolved.exists() and str(resolved) not in active:
            out.append(str(resolved))
    return out


def _legacy_config_dirs() -> list[Path]:
    """Known legacy config directories an old install may have left behind.

    Excludes the live config dir (it holds the current manifest +
    launcher.json) so cleanup never targets the active configuration."""
    live = manifest.manifest_path().parent
    candidates = [
        Path.home() / ".adaptive-learner",
        Path.home() / ".config" / "adaptive_learner",
        Path.home() / ".config" / "bibliogon",
    ]
    return [p for p in candidates if p != live]


def has_stale_artifacts(stale: dict[str, list]) -> bool:
    """True when any stale category is non-empty (#1042)."""
    return any(stale.get(k) for k in ("containers", "images", "volumes", "configs"))


_CLEANUP_CATEGORY_LABELS = (
    ("containers", "Container"),
    ("images", "Image(s)"),
    ("volumes", "Volume(s)"),
    ("configs", "Konfig-Verzeichnis(se)"),
)


def cleanup_offer_lines(stale: dict[str, list]) -> list[str]:
    """Human-readable summary lines for the in-window cleanup offer (#1042).

    One line per non-empty category, e.g.
    ``"2 Container: bibliogon-old, al-legacy"``. Empty list when nothing is
    stale (the caller then shows no offer)."""
    lines: list[str] = []
    for key, label in _CLEANUP_CATEGORY_LABELS:
        items = stale.get(key, [])
        if items:
            lines.append(f"{len(items)} {label}: " + ", ".join(str(i) for i in items))
    return lines


def _manifest_app_version() -> str:
    """Best app-version string for history: the manifest's, else the launcher
    version, else a sentinel."""
    data = manifest.read_manifest()
    if data and data.get("app_version"):
        return str(data["app_version"])
    return __version__


def _record_install_manifest(project: str, compose_file: str, port: int, *, action: str) -> None:
    """Best-effort: snapshot the docker artifacts + (re)write the install
    manifest and append a history entry (#1043). NEVER raises - a manifest
    failure must not fail the install/start it records."""
    try:
        try:
            from adaptive_learner_launcher import installer
            app_version = installer.ADAPTIVE_LEARNER_TARGET_VERSION
        except Exception:  # noqa: BLE001 - version source is best-effort
            app_version = __version__
        arts = collect_installed_artifacts(project)
        compose_path = Path(compose_file)
        manifest.write_install_manifest(
            install_dir=compose_path.parent,
            app_version=app_version,
            launcher_version=__version__,
            port=port,
            compose_project=project,
            compose_file=compose_file,
            containers=arts["containers"],
            images=arts["images"],
            volumes=arts["volumes"],
            config_files=_known_config_files(),
            shortcuts=[],
        )
        manifest.append_history(action, app_version)
    except Exception as exc:  # noqa: BLE001 - manifest is non-critical
        logger.warning("install-manifest write failed: %s", exc)


def _known_config_files() -> list[str]:
    """Config files the launcher manages, recorded in the manifest so cleanup
    knows them. Best-effort (the config module may be unavailable in tests)."""
    try:
        from adaptive_learner_launcher import config
        return [str(config.launcher_config_path())]
    except Exception:  # noqa: BLE001
        return []


def _human_size(num_bytes: int) -> str:
    """Format a byte count the way Docker displays image sizes (decimal,
    e.g. ``245 MB``). ``0 B`` for a zero/unknown size."""
    if num_bytes <= 0:
        return "0 B"
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1000 or unit == "TB":
            return f"{size:.0f} {unit}"
        size /= 1000
    return f"{size:.0f} TB"


def _image_size_bytes(ref: str) -> int:
    """Disk size of a docker image in bytes, or ``0`` when it cannot be
    determined (docker missing, image gone, unparsable output). Best-effort
    and queried BEFORE removal so the freed size can be reported."""
    try:
        result = _run(
            ["docker", "image", "inspect", ref, "--format", "{{.Size}}"],
            timeout=15.0,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return 0
    if result.returncode != 0:
        return 0
    try:
        return int((result.stdout or "").strip())
    except ValueError:
        return 0


def _remove_config_path(path: str) -> tuple[bool, str]:
    """Delete a stale config file or directory. Returns ``(ok, detail)`` and
    never raises; an already-absent path counts as success. Only the legacy,
    non-active config dirs from :func:`find_stale_artifacts` reach here - the
    learner's DATA dir lives elsewhere and is never targeted."""
    target = Path(path).expanduser()
    try:
        if target.is_dir():
            shutil.rmtree(target)
        elif target.exists():
            target.unlink()
        return True, ""
    except OSError as exc:
        return False, str(exc)


def cleanup_stale(stale: dict[str, list], *, on_step: ProgressFn | None = None,
                  remove_volumes_too: bool = False) -> tuple[bool, str]:
    """Remove the STALE artifacts found by :func:`find_stale_artifacts` (#1042).

    Verbose (#1052): a discovery line per category with its count, then a
    SEPARATE ``on_step`` line per container / image / config dir (and, when
    ``remove_volumes_too``, per volume) carrying a ``✓``/``✗`` result, then a
    closing summary (artefacts removed + total space freed + a data-preserved
    note). Image lines append the freed size (e.g. ``✓ (245 MB)``). Volumes are
    DATA - skipped unless the caller opts in. Best-effort: a single failure is
    reported but does not abort the rest. The summary's freed total counts
    image disk size (the dominant, measurable artifact).
    """
    docker_ok, _ = check_docker()
    if not docker_ok:
        return False, _DOCKER_UNAVAILABLE

    containers = stale.get("containers", [])
    images = stale.get("images", [])
    volumes = stale.get("volumes", [])
    configs = stale.get("configs", [])

    _notify(on_step, "Aufraeum-Pruefung...")
    _notify(on_step, f"Suche verwaiste Container... {len(containers)} gefunden")
    _notify(on_step, f"Suche veraltete Images... {len(images)} gefunden")
    _notify(on_step, f"Suche verwaiste Volumes... {len(volumes)} gefunden")
    _notify(on_step, f"Suche Config-Reste... {len(configs)} gefunden")

    removed = 0
    failures = 0
    freed_bytes = 0

    for name in containers:
        ok, detail = _docker_op(["docker", "rm", "-f", name], timeout=60.0)
        _notify(on_step, _step_label(f"Container '{name}' entfernen", ok, detail))
        removed += 1 if ok else 0
        failures += 0 if ok else 1
    for ref in images:
        size = _image_size_bytes(ref)
        ok, detail = _docker_op(["docker", "image", "rm", "--force", ref], timeout=60.0)
        size_note = f" ({_human_size(size)})" if ok and size > 0 else ""
        _notify(on_step, _step_label(f"Image '{ref}' entfernen", ok, detail) + size_note)
        if ok:
            removed += 1
            freed_bytes += size
        else:
            failures += 1
    if remove_volumes_too:
        for vol in volumes:
            ok, detail = _docker_op(["docker", "volume", "rm", vol], timeout=30.0)
            _notify(on_step, _step_label(f"Volume '{vol}' entfernen", ok, detail))
            removed += 1 if ok else 0
            failures += 0 if ok else 1
    for path in configs:
        ok, detail = _remove_config_path(path)
        _notify(on_step, _step_label(f"Config '{path}' entfernen", ok, detail))
        removed += 1 if ok else 0
        failures += 0 if ok else 1

    freed = _human_size(freed_bytes)
    _notify(on_step, "Aufraeumen abgeschlossen.")
    _notify(on_step, f"{removed} Artefakt(e) entfernt, {freed} freigegeben.")
    _notify(on_step, "Lerndaten wurden beibehalten.")
    if failures:
        return False, f"Aufraeumen teilweise fehlgeschlagen ({failures} Schritt(e))."
    return True, f"Aufraeumen abgeschlossen: {removed} Artefakt(e), {freed} freigegeben."


def stack_running(repo: Path, compose_file: str) -> bool:
    """True if the compose stack has at least one running container.

    Compose-project view (``compose ps -q``), distinct from the
    name-filter view in :func:`get_state`. Any failure -> not running.
    """
    try:
        result = _run(
            ["docker", "compose", "-f", compose_file, "ps", "-q"],
            cwd=repo, timeout=15.0,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
    if result.returncode != 0:
        return False
    return bool((result.stdout or "").strip())


def compose_logs_tail(repo: Path, compose_file: str, lines: int = 20) -> str:
    """Return the last ``lines`` of compose output, for error diagnostics."""
    try:
        result = _run(
            ["docker", "compose", "-f", compose_file, "logs", "--tail", str(lines)],
            cwd=repo, timeout=15.0,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return ""
    return (result.stdout or "").strip() or (result.stderr or "").strip()


# --- Health + browser -----------------------------------------------------

def _health_probe(port: int, path: str = HEALTH_PATH) -> tuple[bool, str]:
    """One shot: (healthy, detail). Healthy == HTTP 200 AND JSON
    ``status == "ok"`` (strict). A 5xx is surfaced as a server error."""
    url = f"http://localhost:{port}{path}"
    try:
        with urllib.request.urlopen(url, timeout=3.0) as resp:
            status = resp.status
            body = resp.read().decode("utf-8") if status == 200 else ""
    except Exception as exc:  # noqa: BLE001 - any failure means not-ready-yet
        return False, str(exc)
    if status == 200:
        try:
            if json.loads(body).get("status") == "ok":
                return True, "App ist erreichbar und gesund (status=ok)."
            return False, "Antwort, aber status != ok"
        except json.JSONDecodeError:
            return False, "ungueltige JSON-Antwort"
    if 500 <= status < 600:
        return False, f"Server-Fehler (HTTP {status})"
    return False, f"HTTP {status}"


def is_healthy(port: int, path: str = HEALTH_PATH) -> bool:
    """One-shot health check (no polling). True == healthy now."""
    return _health_probe(port, path)[0]


def health_check(port: int, path: str = HEALTH_PATH, timeout: int = 30) -> tuple[bool, str]:
    """Poll :func:`_health_probe` until healthy or ``timeout`` elapses."""
    import time

    deadline = time.monotonic() + timeout
    last = "keine Antwort"
    while time.monotonic() < deadline:
        ok, detail = _health_probe(port, path)
        if ok:
            return True, detail
        last = detail
        time.sleep(1.0)
    return False, f"App nicht erreichbar nach {timeout}s ({last})."


def open_browser(port: int, path: str = "/") -> None:
    """Open the app in the default browser. Never raises."""
    url = f"http://localhost:{port}{path}"
    logger.debug("open browser: %s", url)
    try:
        webbrowser.open(url)
    except OSError as exc:
        logger.warning("could not open browser: %s", exc)


# --- Version + config -----------------------------------------------------

def get_version() -> str:
    """Return the launcher/app version string."""
    return __version__


def load_config(path: Path) -> dict:
    """Load JSON config from ``path``; return ``{}`` when absent/unreadable."""
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_config(path: Path, config: dict) -> None:
    """Write ``config`` as pretty JSON to ``path`` (creating parent dirs)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config, indent=2, sort_keys=True), encoding="utf-8")


def _validate_port(port: int) -> tuple[bool, str]:
    if not isinstance(port, int) or not (MIN_PORT <= port <= MAX_PORT):
        return False, f"Port muss zwischen {MIN_PORT} und {MAX_PORT} liegen."
    return True, ""


def set_port(path: Path, port: int) -> tuple[bool, str]:
    """Validate (1024-65535) and persist ``port`` into the JSON config."""
    valid, reason = _validate_port(port)
    if not valid:
        return False, reason
    config = load_config(path)
    config["port"] = port
    save_config(path, config)
    return True, f"Port auf {port} gesetzt."


def _tail(result: subprocess.CompletedProcess, lines: int = 12) -> str:
    text = (result.stderr or "").strip() or (result.stdout or "").strip()
    return "\n".join(text.splitlines()[-lines:])
