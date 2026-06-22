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
``on_step(label: str)`` progress callback. The callback is a plain
Python callable - the GUI passes one that marshals onto the Tk thread,
but the action neither knows nor cares.
"""

from __future__ import annotations

import json
import logging
import socket
import subprocess
import urllib.request
import webbrowser
from collections.abc import Callable
from pathlib import Path

from adaptive_learner_launcher import __version__

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

def check_docker() -> tuple[bool, str]:
    """Return (running, message). True only when the daemon is reachable."""
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

def check_port(port: int) -> tuple[bool, str]:
    """Return (free, message). Validates the range first, then whether
    anything is listening. Free == in range AND nothing listening."""
    valid, reason = _validate_port(port)
    if not valid:
        return False, reason
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1.0)
        in_use = sock.connect_ex(("127.0.0.1", port)) == 0
    if in_use:
        return False, f"Port {port} ist belegt."
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
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            if sock.connect_ex(("127.0.0.1", candidate)) != 0:
                return True, candidate, f"Freier Port gefunden: {candidate}."
    return False, 0, "Kein freier Port gefunden."


# --- Lifecycle (install / start / stop / uninstall) -----------------------

def _compose(project: str, compose_file: str, *args: str, timeout: float) -> subprocess.CompletedProcess:
    return _run(
        ["docker", "compose", "-p", project, "-f", compose_file, *args],
        timeout=timeout,
    )


_DOCKER_UNAVAILABLE = "Docker ist nicht verfuegbar (nicht gestartet)."


def install(compose_file: str, project: str = DEFAULT_PROJECT, port: int = DEFAULT_PORT,
            *, on_step: ProgressFn | None = None) -> tuple[bool, str]:
    """Build + start the stack, then VERIFY it is running and healthy.

    Guards (each returns ``(False, ...)``): invalid port, Docker down,
    missing compose file, occupied port. If the app is already running it
    returns ``(True, "Bereits installiert")``.
    """
    valid, reason = _validate_port(port)
    if not valid:
        return False, reason
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
    _notify(on_step, "Docker-Images werden gebaut (beim ersten Mal einige Minuten)...")
    try:
        result = _compose(project, compose_file, "up", "--build", "-d", timeout=600.0)
    except FileNotFoundError:
        return False, _DOCKER_UNAVAILABLE
    except subprocess.TimeoutExpired:
        return False, "Docker-Build hat das Zeitlimit (10 Min) ueberschritten."
    if result.returncode != 0:
        return False, f"Docker-Build fehlgeschlagen:\n{_tail(result)}"
    _notify(on_step, "Bereitschaft pruefen...")
    if get_state(project) != "running":
        return False, "Container wurde gebaut, laeuft aber nicht."
    healthy, health_msg = health_check(port, HEALTH_PATH, timeout=120)
    if not healthy:
        return False, f"Installiert, aber die App ist nicht erreichbar: {health_msg}"
    return True, "Installation abgeschlossen. App ist bereit."


def start(compose_file: str, project: str = DEFAULT_PROJECT,
          *, on_step: ProgressFn | None = None) -> tuple[bool, str]:
    """Start a stopped stack, then VERIFY it is running."""
    docker_ok, _ = check_docker()
    if not docker_ok:
        return False, _DOCKER_UNAVAILABLE
    state = get_state(project)
    if state == "running":
        return True, "App laeuft bereits."
    if state == "not_installed":
        return False, "App ist nicht installiert."
    _notify(on_step, "Container starten...")
    try:
        result = _compose(project, compose_file, "up", "-d", timeout=120.0)
    except FileNotFoundError:
        return False, _DOCKER_UNAVAILABLE
    except subprocess.TimeoutExpired:
        return False, "Start hat das Zeitlimit ueberschritten."
    if result.returncode != 0:
        return False, f"Start fehlgeschlagen:\n{_tail(result)}"
    if get_state(project) != "running":
        return False, "Start-Befehl lief, aber kein Container laeuft."
    return True, "App gestartet."


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


def uninstall(project: str = DEFAULT_PROJECT) -> tuple[bool, str]:
    """Force-remove containers (and images), then VERIFY they are gone.

    Removes by id (``docker rm -f``) so it works regardless of the compose
    directory, and re-lists to confirm - never claims success while a
    container survives. Volumes are PRESERVED (data survives a reinstall).
    """
    docker_ok, _ = check_docker()
    if not docker_ok:
        return False, _DOCKER_UNAVAILABLE
    ids = _project_container_ids(running_only=False)
    if not ids:
        return True, "Nichts zu deinstallieren (kein Container vorhanden)."
    try:
        _run(["docker", "rm", "-f", *ids], timeout=60.0)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return False, f"Entfernen fehlgeschlagen: {exc}"
    remaining = _project_container_ids(running_only=False)
    if remaining:
        return False, f"Teilweise entfernt: {len(remaining)} Container konnte(n) nicht entfernt werden."
    _remove_images()  # best-effort, frees disk; never blocks success
    return True, "Deinstallation abgeschlossen. Deine Lerndaten bleiben erhalten."


def _remove_images() -> None:
    try:
        result = _run([
            "docker", "images",
            "--filter", "reference=*adaptive-learner*",
            "--filter", "reference=*adaptive_learner*",
            "-q",
        ])
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return
    images = [i for i in (result.stdout or "").strip().splitlines() if i]
    if images:
        try:
            _run(["docker", "image", "rm", "--force", *images], timeout=60.0)
        except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
            logger.warning("image removal failed: %s", exc)


# --- Health + browser -----------------------------------------------------

def health_check(port: int, path: str = HEALTH_PATH, timeout: int = 30) -> tuple[bool, str]:
    """Poll ``http://localhost:{port}{path}`` until it responds 2xx or times out."""
    import time

    url = f"http://localhost:{port}{path}"
    deadline = time.monotonic() + timeout
    last = "keine Antwort"
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3.0) as resp:
                if 200 <= resp.status < 300:
                    return True, f"App ist erreichbar (HTTP {resp.status})."
                last = f"HTTP {resp.status}"
        except Exception as exc:  # noqa: BLE001 - any failure means not-ready-yet
            last = str(exc)
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
