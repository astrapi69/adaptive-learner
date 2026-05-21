"""System-info endpoint for the About tab (Phase 14A).

Returns app identity + runtime + bundled-dependency versions +
data paths. Consumed by the Settings > About tab in API storage
mode. In Dexie mode the frontend generates an equivalent payload
locally (no backend reachable), so this endpoint is only one of
two information sources.

Design borrowed from the Bibliogon ``system`` router and adapted
to Adaptive Learner's filesystem isolation (``app.paths``) and
the fact that ``build_hash`` / ``build_date`` need git, which is
available in dev but not always in a frozen launcher.
"""

from __future__ import annotations

import platform
import subprocess
import sys
import tomllib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from app import __version__
from app.paths import get_data_dir, get_db_path

router = APIRouter(prefix="/system", tags=["system"])

_PYPROJECT = Path(__file__).resolve().parent.parent.parent / "pyproject.toml"
_REPO_ROOT = _PYPROJECT.parent.parent

# Canonical project URLs. Hardcoded once here so the About payload
# stays self-contained; ``pyproject.toml``'s ``[tool.poetry.urls]``
# block is not enforced by tooling when ``package-mode = false``.
_REPOSITORY_URL = "https://github.com/astrapi69/adaptive-learner"
_ISSUES_URL = "https://github.com/astrapi69/adaptive-learner/issues"
_DOCS_URL = "https://astrapi69.github.io/adaptive-learner/docs/"


def _read_pyproject_field(field: str, default: Any = None) -> Any:
    try:
        with _PYPROJECT.open("rb") as handle:
            data = tomllib.load(handle)
        return data.get("tool", {}).get("poetry", {}).get(field, default)
    except (OSError, tomllib.TOMLDecodeError):
        return default


def _safe_module_version(module_name: str) -> str | None:
    """Resolve a bundled dep's ``__version__`` without crashing.

    Returns ``None`` when the module isn't importable (optional
    extras, or stripped install). The frontend renders the
    missing field as "unknown" or hides the row.
    """
    try:
        module = __import__(module_name)
        version = getattr(module, "__version__", None)
        return version if isinstance(version, str) else None
    except ImportError:
        return None


def _git_short_hash() -> str | None:
    """``git rev-parse --short HEAD`` if a working tree is reachable.

    Returns ``None`` when:
      - Not running from a git checkout (frozen launcher, Docker
        image without ``.git``, sdist install).
      - ``git`` binary is missing on the PATH.
      - Any timeout / non-zero exit.

    Callers treat ``None`` as "build hash unavailable" and the UI
    surfaces "unknown".
    """
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=_REPO_ROOT,
            check=False,
            timeout=2,
            capture_output=True,
            text=True,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return None
    if proc.returncode != 0:
        return None
    short = proc.stdout.strip()
    return short if short else None


def _build_date_iso() -> str:
    """Best-effort build date.

    For a git checkout we use the HEAD commit's author date so
    builds from the same commit stamp identically. Falls back to
    ``now()`` when git is unavailable (frozen builds set their
    own build date via PyInstaller's spec; that path doesn't run
    this code).
    """
    try:
        proc = subprocess.run(
            ["git", "log", "-1", "--format=%cI", "HEAD"],
            cwd=_REPO_ROOT,
            check=False,
            timeout=2,
            capture_output=True,
            text=True,
        )
        if proc.returncode == 0:
            stamp = proc.stdout.strip()
            if stamp:
                return stamp
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        pass
    return datetime.now(UTC).isoformat()


@router.get("/info")
def get_system_info() -> dict[str, Any]:
    """Aggregate the About-tab payload.

    Shape (stable through About v1):
      - ``app``: name, version, license, authors, urls, build_hash,
        build_date
      - ``runtime``: python_version, platform_system,
        platform_release, platform_machine
      - ``dependencies``: fastapi, sqlalchemy, pydantic, pluginforge
      - ``paths``: database_path, data_directory

    Missing fields surface as ``None`` / ``"unknown"`` strings so
    the frontend can degrade gracefully. Tests assert SHAPE, not
    exact values (Python + platform + git state vary per env).
    """
    authors_raw = _read_pyproject_field("authors", []) or []
    authors: list[str] = [str(a) for a in authors_raw if isinstance(a, str)]
    license_str = _read_pyproject_field("license", "MIT") or "MIT"
    if not isinstance(license_str, str):
        license_str = "MIT"
    build_hash = _git_short_hash() or "unknown"

    return {
        "app": {
            "name": "Adaptive Learner",
            "version": __version__,
            "license": license_str,
            "authors": authors,
            "repository_url": _REPOSITORY_URL,
            "issues_url": _ISSUES_URL,
            "docs_url": _DOCS_URL,
            "build_hash": build_hash,
            "build_date": _build_date_iso(),
        },
        "runtime": {
            "python_version": sys.version.split()[0],
            "platform_system": platform.system(),
            "platform_release": platform.release(),
            "platform_machine": platform.machine(),
        },
        "dependencies": {
            "fastapi": _safe_module_version("fastapi"),
            "sqlalchemy": _safe_module_version("sqlalchemy"),
            "pydantic": _safe_module_version("pydantic"),
            "pluginforge": _safe_module_version("pluginforge"),
        },
        "paths": {
            "database_path": str(get_db_path()),
            "data_directory": str(get_data_dir()),
        },
    }
