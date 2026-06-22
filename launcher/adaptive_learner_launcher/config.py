"""Launcher config: repo path, port, user config file, lockfile paths.

Single source of truth for where things live on disk. Pure functions so
they are unit-testable without touching the real filesystem.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path


APP_NAME = "AdaptiveLearner"
# 8501 is Adaptive Learner's own default host port. It must NOT be 7880
# (that is Bibliogon's port) - defaulting there guaranteed a conflict with
# a sibling app on the same machine.
DEFAULT_PORT = 8501
DEFAULT_REPO_DIR_NAME = "adaptive_learner"
COMPOSE_FILENAME = "docker-compose.prod.yml"
ENV_FILENAME = ".env"
ENV_EXAMPLE_FILENAME = ".env.example"

_PORT_LINE_RE = re.compile(r"^\s*ADAPTIVE_LEARNER_PORT\s*=\s*(\d+)\s*$", re.MULTILINE)
_PUBLIC_PORT_LINE_RE = re.compile(
    r"^\s*ADAPTIVE_LEARNER_PUBLIC_PORT\s*=\s*(\d+)\s*$", re.MULTILINE
)
PUBLIC_PORT_ENV_KEY = "ADAPTIVE_LEARNER_PUBLIC_PORT"


def appdata_dir(env: dict[str, str] | None = None) -> Path:
    """Return the user's per-app config directory.

    On Windows this is ``%APPDATA%\\AdaptiveLearner``. On non-Windows (used by
    tests running on CI or Linux devs), fall back to
    ``~/.config/AdaptiveLearner`` so the same code path exercises in unit tests.
    """
    env = env if env is not None else dict(os.environ)
    appdata = env.get("APPDATA")
    if appdata:
        return Path(appdata) / APP_NAME
    home = Path(env.get("HOME", "~")).expanduser()
    return home / ".config" / APP_NAME


def launcher_config_path(env: dict[str, str] | None = None) -> Path:
    return appdata_dir(env) / "launcher.json"


def lockfile_path(env: dict[str, str] | None = None) -> Path:
    return appdata_dir(env) / "launcher.lock"


def logfile_path(env: dict[str, str] | None = None) -> Path:
    return appdata_dir(env) / "launcher.log"


def default_repo_path(env: dict[str, str] | None = None) -> Path:
    """Default install location used when the user has not configured one."""
    env = env if env is not None else dict(os.environ)
    profile = env.get("USERPROFILE") or env.get("HOME") or "~"
    return Path(profile).expanduser() / DEFAULT_REPO_DIR_NAME


def load_launcher_config(env: dict[str, str] | None = None) -> dict:
    """Load persisted launcher config, empty dict on first run or parse error."""
    path = launcher_config_path(env)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_launcher_config(data: dict, env: dict[str, str] | None = None) -> None:
    path = launcher_config_path(env)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def get_show_details_default(env: dict[str, str] | None = None) -> bool:
    """Return the persisted "always show technical details" toggle.

    Default is False so end users see the plain-language view first.
    Developers can set this to True in ``launcher.json`` to auto-expand
    the details block on every error dialog.
    """
    cfg = load_launcher_config(env)
    return bool(cfg.get("show_details_by_default", False))


def resolve_repo_path(env: dict[str, str] | None = None) -> Path:
    """Return the configured repo path or the default. Does not verify existence."""
    cfg = load_launcher_config(env)
    configured = cfg.get("repo_path")
    if configured:
        return Path(configured).expanduser()
    return default_repo_path(env)


def is_valid_repo(repo: Path) -> bool:
    """A valid repo has the production compose file we invoke."""
    return (repo / COMPOSE_FILENAME).is_file()


def read_port(repo: Path) -> int:
    """Read ``ADAPTIVE_LEARNER_PORT`` (the internal backend port) from ``.env``.

    Retained for backward compatibility; the launcher opens the browser
    and runs the health check against the *public* host port instead -
    see :func:`read_public_port`. The production compose stack only
    publishes the public port to the host, so that is the one the
    launcher must use.
    """
    return _read_port_with(repo, _PORT_LINE_RE)


def read_public_port(repo: Path) -> int:
    """Read ``ADAPTIVE_LEARNER_PUBLIC_PORT`` from ``.env``; fall back to default.

    The public port is the host-published port the user reaches in the
    browser (``docker-compose.prod.yml`` maps it to the frontend nginx
    container). The launcher opens the browser and waits for health on
    this port.
    """
    return _read_port_with(repo, _PUBLIC_PORT_LINE_RE)


def _read_port_with(repo: Path, pattern: re.Pattern[str]) -> int:
    env_file = repo / ENV_FILENAME
    if not env_file.is_file():
        return DEFAULT_PORT
    try:
        match = pattern.search(env_file.read_text(encoding="utf-8"))
    except OSError:
        return DEFAULT_PORT
    if not match:
        return DEFAULT_PORT
    try:
        port = int(match.group(1))
    except ValueError:
        return DEFAULT_PORT
    return port if 1 <= port <= 65535 else DEFAULT_PORT


def resolve_launch_port(
    repo: Path,
    *,
    cli_port: int | None = None,
    env: dict[str, str] | None = None,
) -> int:
    """Resolve the effective host port the launcher should publish on.

    Precedence (first valid wins):
      1. ``--port`` from the command line (``cli_port``).
      2. ``port`` in ``launcher.json``.
      3. ``ADAPTIVE_LEARNER_PUBLIC_PORT`` in the repo ``.env``.
      4. :data:`DEFAULT_PORT`.

    A value out of the 1-65535 range is ignored in favour of the next
    source.
    """
    if _is_valid_port(cli_port):
        return int(cli_port)  # type: ignore[arg-type]
    configured = load_launcher_config(env).get("port")
    if _is_valid_port(configured):
        return int(configured)
    return read_public_port(repo)


def _is_valid_port(value: object) -> bool:
    try:
        port = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return False
    return 1 <= port <= 65535


def write_public_port(repo: Path, port: int) -> None:
    """Persist ``ADAPTIVE_LEARNER_PUBLIC_PORT`` into the repo ``.env``.

    Upserts the line so the next ``docker compose up`` publishes the
    frontend on the chosen host port (and the CORS origin, which
    interpolates the same variable, stays consistent). Creates ``.env``
    if it does not exist yet.
    """
    env_file = repo / ENV_FILENAME
    line = f"{PUBLIC_PORT_ENV_KEY}={port}"
    try:
        text = env_file.read_text(encoding="utf-8") if env_file.is_file() else ""
    except OSError:
        text = ""
    if _PUBLIC_PORT_LINE_RE.search(text):
        text = _PUBLIC_PORT_LINE_RE.sub(line, text, count=1)
    else:
        if text and not text.endswith("\n"):
            text += "\n"
        text += line + "\n"
    env_file.write_text(text, encoding="utf-8")
