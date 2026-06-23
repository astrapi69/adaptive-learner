"""Install manifest for tracking AdaptiveLearner installation state.

The manifest is a small JSON file stored in the platform-specific user
config directory (``platformdirs.user_config_dir("adaptive_learner")``):

- Linux:   ``~/.config/adaptive_learner/install.json``
- macOS:   ``~/Library/Application Support/adaptive_learner/install.json``
- Windows: ``%APPDATA%\\adaptive_learner\\install.json``

Written by the launcher after a successful install and read on every
startup to determine whether to show the install UI or the main UI.
"""

from __future__ import annotations

import json
import platform
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from platformdirs import user_config_dir

APP_NAME = "adaptive_learner"
MANIFEST_FILENAME = "install.json"


def manifest_path() -> Path:
    """Return the platform-specific path for the install manifest."""
    return Path(user_config_dir(APP_NAME)) / MANIFEST_FILENAME


def read_manifest() -> dict[str, Any] | None:
    """Read the install manifest, or None if absent/malformed.

    Fails open: a corrupt or unreadable manifest is treated as
    absent (no installation), never as a crash.
    """
    path = manifest_path()
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError, UnicodeDecodeError):
        return None


def write_manifest(install_dir: Path, version: str) -> None:
    """Write the install manifest after a successful installation."""
    path = manifest_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "version": version,
        "install_dir": str(install_dir),
        "installed_at": datetime.now(timezone.utc).isoformat(),
        "platform": platform.system().lower(),
    }
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def delete_manifest() -> None:
    """Remove the install manifest. No-op if already absent."""
    path = manifest_path()
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def install_dir_from_manifest() -> Path | None:
    """Return the install directory from the manifest, or None.

    Returns None if the manifest is absent, malformed, or the
    ``install_dir`` field is missing.
    """
    data = read_manifest()
    if data is None:
        return None
    raw = data.get("install_dir")
    if not raw:
        return None
    return Path(raw)


# --- Rich install manifest (#1043) ----------------------------------------
#
# The same ``install.json`` carries a richer record so the startup cleanup
# (#1042) knows EXACTLY what a prior install created: the compose project +
# file, the containers/images/volumes, the config files + shortcuts, and an
# append-only ``install_history`` audit trail. The legacy ``version`` /
# ``install_dir`` / ``installed_at`` fields stay present so
# :func:`install_dir_from_manifest` and the existing readers keep working.

MANIFEST_SCHEMA_VERSION = 1


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_install_manifest(
    *,
    install_dir: Path,
    app_version: str,
    launcher_version: str,
    port: int,
    compose_project: str,
    compose_file: Path | str | None,
    containers: list[dict[str, str]],
    images: list[str],
    volumes: list[str],
    config_files: list[str] | None = None,
    shortcuts: list[str] | None = None,
) -> None:
    """Write/refresh the rich install manifest after a successful install or
    rebuild.

    Preserves the existing ``installed_at`` and the append-only
    ``install_history`` across rewrites; refreshes ``updated_at`` and the
    artifact lists. Keeps the legacy ``version`` / ``install_dir`` fields so
    older readers (``install_dir_from_manifest``) stay valid.
    """
    existing = read_manifest() or {}
    installed_at = existing.get("installed_at") or _now()
    history = list(existing.get("install_history", []))
    data: dict[str, Any] = {
        "manifest_schema": MANIFEST_SCHEMA_VERSION,
        "app_name": "Adaptive Learner",
        "app_version": app_version,
        "launcher_version": launcher_version,
        "version": app_version,  # legacy alias (kept for old readers)
        "install_dir": str(install_dir),
        "installed_at": installed_at,
        "updated_at": _now(),
        "platform": platform.system().lower(),
        "status": "installed",
        "port": port,
        "compose_project": compose_project,
        "compose_file": str(compose_file) if compose_file else None,
        "containers": containers,
        "images": images,
        "volumes": volumes,
        "config_files": list(config_files or []),
        "shortcuts": list(shortcuts or []),
        "install_history": history,
    }
    path = manifest_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def append_history(action: str, version: str) -> None:
    """Append one entry to the manifest's ``install_history`` audit trail.

    ``action`` is ``"install"`` / ``"update"`` / ``"uninstall"``. Creates a
    minimal history-only manifest when none exists yet (so the trail survives
    even for a legacy install). Fail-open on write errors.
    """
    data = read_manifest() or {}
    history = list(data.get("install_history", []))
    history.append({"action": action, "version": version, "at": _now()})
    data["install_history"] = history
    try:
        path = manifest_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except OSError:
        pass


def mark_uninstalled(version: str) -> None:
    """Mark the install as uninstalled after a successful uninstall (#1043).

    Appends an ``uninstall`` history entry, sets ``status="uninstalled"``,
    stamps ``uninstalled_at``, and CLEARS the artifact lists (they are gone),
    while KEEPING the audit trail. A subsequent cleanup scan therefore finds
    nothing to remove for this install. No-op when no manifest exists.
    """
    data = read_manifest()
    if data is None:
        return
    history = list(data.get("install_history", []))
    history.append({"action": "uninstall", "version": version, "at": _now()})
    data["install_history"] = history
    data["status"] = "uninstalled"
    data["uninstalled_at"] = _now()
    data["containers"] = []
    data["images"] = []
    data["volumes"] = []
    try:
        path = manifest_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except OSError:
        pass


def manifest_artifacts() -> dict[str, list]:
    """Return the artifacts the manifest currently records (#1042/#1043).

    ``{"containers": [name,...], "images": [ref,...], "volumes": [name,...],
    "configs": [path,...]}``. Empty lists when the manifest is absent or the
    install is marked uninstalled. ``containers`` is flattened to names.
    """
    data = read_manifest()
    if data is None or data.get("status") == "uninstalled":
        return {"containers": [], "images": [], "volumes": [], "configs": []}
    containers = [
        c.get("name", "") if isinstance(c, dict) else str(c)
        for c in data.get("containers", [])
    ]
    return {
        "containers": [c for c in containers if c],
        "images": list(data.get("images", [])),
        "volumes": list(data.get("volumes", [])),
        "configs": list(data.get("config_files", [])),
    }


# --- Cleanup state persistence ---

CLEANUP_FILENAME = "cleanup.json"

CLEANUP_STEPS = (
    "compose_down",
    "remove_volumes",
    "remove_images",
    "rmtree",
    "delete_manifest",
)


def cleanup_path() -> Path:
    """Return the platform-specific path for the cleanup state file."""
    return Path(user_config_dir(APP_NAME)) / CLEANUP_FILENAME


def read_cleanup_pending() -> dict[str, Any] | None:
    """Read the cleanup state, or None if absent/malformed. Fail-open."""
    path = cleanup_path()
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError, UnicodeDecodeError):
        return None


def write_cleanup_pending(install_dir: Path) -> None:
    """Write a fresh cleanup state with all steps pending (False)."""
    path = cleanup_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "pending_since": datetime.now(timezone.utc).isoformat(),
        "install_dir": str(install_dir),
        "steps": {step: False for step in CLEANUP_STEPS},
    }
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def update_cleanup_step(step: str, success: bool) -> None:
    """Mark a single cleanup step as completed. Fail-open on write errors."""
    data = read_cleanup_pending()
    if data is None:
        return
    steps = data.get("steps", {})
    steps[step] = success
    data["steps"] = steps
    try:
        cleanup_path().write_text(json.dumps(data, indent=2), encoding="utf-8")
    except OSError:
        pass


def delete_cleanup_pending() -> None:
    """Remove the cleanup state file. No-op if absent."""
    try:
        cleanup_path().unlink()
    except FileNotFoundError:
        pass


def all_cleanup_done(data: dict[str, Any] | None) -> bool:
    """True if every cleanup step is marked True."""
    if data is None:
        return True
    steps = data.get("steps", {})
    return all(steps.get(s, False) for s in CLEANUP_STEPS)
