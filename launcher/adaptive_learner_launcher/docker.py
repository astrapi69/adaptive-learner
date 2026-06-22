"""Docker + compose interaction. Kept as thin subprocess wrappers.

Every function returns a ``tuple[ok: bool, detail: str]`` so UI code can
render a concrete error message rather than re-inventing failure strings.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import sys
from pathlib import Path


logger = logging.getLogger("adaptive_learner_launcher.docker")


# Windows-specific: hide the flashing black cmd.exe window when launched
# from a --windowed PyInstaller build. On non-Windows this is a no-op.
_CREATE_NO_WINDOW = 0x08000000


def _creation_flags() -> int:
    if sys.platform == "win32":
        return _CREATE_NO_WINDOW
    return 0


def _run(cmd: list[str], *, cwd: Path | None = None, timeout: float = 10.0) -> subprocess.CompletedProcess:
    logger.debug("docker exec: %s (cwd=%s, timeout=%ss)", " ".join(cmd), cwd, timeout)
    result = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        capture_output=True,
        text=True,
        timeout=timeout,
        creationflags=_creation_flags(),
    )
    logger.debug(
        "docker exit=%s stdout=%r stderr=%r",
        result.returncode, (result.stdout or "")[-2000:], (result.stderr or "")[-2000:],
    )
    return result


def docker_installed() -> tuple[bool, str]:
    """True if ``docker --version`` succeeds."""
    try:
        result = _run(["docker", "--version"])
    except FileNotFoundError:
        return False, "docker command not found on PATH"
    except subprocess.TimeoutExpired:
        return False, "docker --version timed out"
    if result.returncode != 0:
        return False, result.stderr.strip() or "docker --version exited non-zero"
    return True, result.stdout.strip()


def docker_daemon_running() -> tuple[bool, str]:
    """True if ``docker info`` succeeds, i.e. the daemon is reachable."""
    try:
        result = _run(["docker", "info"], timeout=15.0)
    except FileNotFoundError:
        return False, "docker command not found on PATH"
    except subprocess.TimeoutExpired:
        return False, "docker info timed out; Docker Desktop may be starting"
    if result.returncode != 0:
        stderr = result.stderr.strip()
        return False, stderr.splitlines()[0] if stderr else "daemon not reachable"
    return True, "running"


def start_docker_desktop() -> tuple[bool, str]:
    """Best-effort launch of Docker Desktop for the current platform.

    Returns ``(True, detail)`` when the start command was dispatched (the
    daemon still needs ~30 s to come up, so the caller should poll
    :func:`docker_daemon_running` afterwards), or ``(False, detail)`` when
    no known launch path worked. Never raises; a failure here only means
    the user has to start Docker Desktop by hand.
    """
    platform = sys.platform
    try:
        if platform == "darwin":
            subprocess.Popen(["open", "-a", "Docker"])
            return True, "open -a Docker"
        if platform == "win32":
            candidates = [
                Path(r"C:\Program Files\Docker\Docker\Docker Desktop.exe"),
                Path(r"C:\Program Files\Docker\Docker\frontend\Docker Desktop.exe"),
            ]
            for exe in candidates:
                if exe.is_file():
                    subprocess.Popen([str(exe)], creationflags=_creation_flags())
                    return True, str(exe)
            return False, "Docker Desktop.exe not found in the default location"
        # Linux: Docker Desktop ships a desktop launcher; fall back to it.
        launcher = shutil.which("docker-desktop") or shutil.which("systemctl")
        if launcher and launcher.endswith("systemctl"):
            subprocess.Popen([launcher, "--user", "start", "docker-desktop"])
            return True, "systemctl --user start docker-desktop"
        if launcher:
            subprocess.Popen([launcher])
            return True, launcher
        return False, "no Docker Desktop launcher found on PATH"
    except (OSError, ValueError) as exc:
        return False, f"could not start Docker Desktop: {exc}"


def compose_up(repo: Path, compose_file: str) -> tuple[bool, str]:
    """Start the stack detached. Returns the compose output on failure."""
    try:
        result = _run(
            ["docker", "compose", "-f", compose_file, "up", "-d"],
            cwd=repo,
            timeout=120.0,
        )
    except FileNotFoundError:
        return False, "docker command not found on PATH"
    except subprocess.TimeoutExpired:
        return False, "docker compose up timed out after 120s"
    if result.returncode != 0:
        return False, _tail_output(result)
    return True, "started"


def compose_down(repo: Path, compose_file: str) -> tuple[bool, str]:
    try:
        result = _run(
            ["docker", "compose", "-f", compose_file, "down"],
            cwd=repo,
            timeout=60.0,
        )
    except FileNotFoundError:
        return False, "docker command not found on PATH"
    except subprocess.TimeoutExpired:
        return False, "docker compose down timed out after 60s"
    if result.returncode != 0:
        return False, _tail_output(result)
    return True, "stopped"


# Container-name filters covering the current ``adaptive-learner`` project
# (compose sets container_name adaptive-learner-backend / -frontend) plus the
# legacy ``adaptive_learner`` (underscore) names a faulty older launcher may
# have created. Multiple ``--filter name=`` are OR'd by docker.
_CONTAINER_NAME_FILTERS = ["name=adaptive-learner", "name=adaptive_learner"]


def _list_app_container_ids() -> list[str]:
    """Return the ids of all Adaptive Learner containers (running OR stopped).

    Empty list when docker is unavailable or none exist. Used by the
    uninstall path to remove by id (works regardless of which directory
    the compose project was started from) and to VERIFY removal.
    """
    cmd = ["docker", "ps", "-aq"]
    for flt in _CONTAINER_NAME_FILTERS:
        cmd += ["--filter", flt]
    try:
        result = _run(cmd, timeout=15.0)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    return [cid for cid in (result.stdout or "").strip().splitlines() if cid]


def remove_containers() -> tuple[bool, str]:
    """Force-remove every Adaptive Learner container, then VERIFY it is gone.

    ``docker rm -f`` stops + removes in one step and works by id, so it
    does not depend on the compose file being found in a particular
    directory (the failure mode where ``compose down`` reported success
    but removed nothing). Returns ``(False, detail)`` if any container
    survives, so the caller never claims a successful uninstall while a
    container is still present.
    """
    ids = _list_app_container_ids()
    if ids:
        try:
            _run(["docker", "rm", "-f", *ids], timeout=60.0)
        except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
            return False, f"container removal failed: {exc}"
    remaining = _list_app_container_ids()
    if remaining:
        return False, f"{len(remaining)} container(s) could not be removed: {', '.join(remaining)}"
    return True, f"removed {len(ids)} container(s)"


def stack_running(repo: Path, compose_file: str) -> bool:
    """True if the compose stack has at least one running container.

    Uses ``docker compose ps -q`` which lists only running service
    containers; a non-empty result means the app is up. Any failure
    (docker missing, daemon down, compose error) is treated as
    not-running so the caller falls back to the start flow.
    """
    try:
        result = _run(
            ["docker", "compose", "-f", compose_file, "ps", "-q"],
            cwd=repo,
            timeout=15.0,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
    if result.returncode != 0:
        return False
    return bool((result.stdout or "").strip())


def compose_logs_tail(repo: Path, compose_file: str, lines: int = 20) -> str:
    """Return the last ``lines`` of container output for error reporting."""
    try:
        result = _run(
            ["docker", "compose", "-f", compose_file, "logs", "--tail", str(lines)],
            cwd=repo,
            timeout=15.0,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return "(logs unavailable)"
    return (result.stdout or result.stderr or "(no output)").strip()


def remove_volumes() -> tuple[bool, str]:
    """Remove all Docker volumes belonging to Adaptive Learner.

    Matches both the current ``adaptive-learner`` (hyphen) project name
    and the legacy ``adaptive_learner`` (underscore) one so an old
    install is still cleaned up. Same-key Docker filters are OR'd, so a
    single ``volume ls`` returns the union. Dynamic lookup so we never
    hardcode volume names that vary by compose config.
    """
    try:
        result = _run([
            "docker", "volume", "ls",
            "--filter", "name=adaptive-learner",
            "--filter", "name=adaptive_learner",
            "-q",
        ])
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return True, "docker not available, skipping"
    volumes = [v for v in (result.stdout or "").strip().splitlines() if v]
    if not volumes:
        return True, "no volumes found"
    try:
        _run(["docker", "volume", "rm"] + volumes, timeout=30.0)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return False, f"volume removal failed: {exc}"
    return True, f"removed {len(volumes)} volume(s)"


def remove_images() -> tuple[bool, str]:
    """Remove all Adaptive Learner Docker images.

    Matches both the ``adaptive-learner`` (hyphen) and legacy
    ``adaptive_learner`` (underscore) image references. Uses ``--force``
    so running containers do not block removal.
    """
    try:
        result = _run([
            "docker", "images",
            "--filter", "reference=*adaptive-learner*",
            "--filter", "reference=*adaptive_learner*",
            "-q",
        ])
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return True, "docker not available, skipping"
    images = [i for i in (result.stdout or "").strip().splitlines() if i]
    if not images:
        return True, "no images found"
    try:
        _run(["docker", "image", "rm", "--force"] + images, timeout=60.0)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return False, f"image removal failed: {exc}"
    return True, f"removed {len(images)} image(s)"


def compose_build(repo: Path, compose_file: str) -> tuple[bool, str]:
    """Build images and start the stack. Used by the install flow where
    images need to be pulled/built for the first time."""
    try:
        result = _run(
            ["docker", "compose", "-f", compose_file, "up", "--build", "-d"],
            cwd=repo,
            timeout=600.0,  # first build can take several minutes
        )
    except FileNotFoundError:
        return False, "docker command not found on PATH"
    except subprocess.TimeoutExpired:
        return False, "docker compose up --build timed out after 10 minutes"
    if result.returncode != 0:
        return False, _tail_output(result)
    return True, "started"


def _tail_output(result: subprocess.CompletedProcess) -> str:
    """Surface the last diagnostic lines, preferring stderr over stdout."""
    text = result.stderr.strip() or result.stdout.strip()
    lines = text.splitlines()
    return "\n".join(lines[-10:]) or "(no output)"
