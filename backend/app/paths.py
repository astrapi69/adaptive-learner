"""Runtime data-path helpers + production marker constants.

Phase 2 of the test-isolation hardening (Phase 1 added the marker
file + conftest tripwire in commit a4cf7cf and the follow-up
filesystem sweep; this module's job in Phase 2 is to swap the
default data root from the project tree to a platformdirs
XDG-conformant location).

Two design constraints carried forward from Phase 1:

1. Paths resolve via either ``ADAPTIVE_LEARNER_DATA_DIR`` env var (highest
   priority - tests, Docker, admin overrides) or platformdirs.
   They do NOT resolve relative to the current working directory;
   the original ``Path("uploads")`` was CWD-relative, the trap
   exposed by the April 2026 data-loss incident.
2. ``get_upload_dir()`` (and friends) is a function call, never a
   module-level constant. Tests that ``monkeypatch`` env vars
   AFTER ``app.*`` import must still see the new value; frozen
   imports defeat that.

Resolver naming convention matches platformdirs (data / config /
cache). All four (``get_data_dir``, ``get_config_dir``,
``get_cache_dir``, plus the convenience ``get_upload_dir`` /
``get_db_path``) live in this module so a future contributor
finds them as a complete set.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from platformdirs import user_cache_dir, user_config_dir, user_data_dir

logger = logging.getLogger(__name__)

PRODUCTION_MARKER_FILENAME = ".adaptive-learner-production"
APP_NAME = "adaptive_learner"


def _strip_snap_sandbox(resolved: Path) -> Path:
    """Return the real-home equivalent of a snap-sandbox-rewritten path.

    A snap-packaged terminal (e.g. VSCode installed as a snap) rewrites
    the ``XDG_*`` env vars to ``<home>/snap/<name>/<revision>/...`` - a
    PER-REVISION directory, so every snap refresh would silently strand
    the whole data dir and boot a fresh empty one (#1814). When
    ``resolved`` lies under such a prefix, the three sandbox components
    (``snap/<name>/<revision>``) are dropped so the path lands in the
    stable real home. Anything else - including a literal ``snap``
    segment outside the home directory - passes through unchanged.

    Applied ONLY to the platformdirs branch of the resolvers; an
    explicit ``ADAPTIVE_LEARNER_*_DIR`` override is admin intent and is
    honoured verbatim.
    """
    home = Path.home().resolve()
    try:
        relative = resolved.relative_to(home)
    except ValueError:
        return resolved
    parts = relative.parts
    if len(parts) < 4 or parts[0] != "snap":
        return resolved
    stable = home.joinpath(*parts[3:])
    logger.warning(
        "Ignoring snap-sandbox path %s (per-revision, stranded on every "
        "snap refresh) - using %s instead. Set ADAPTIVE_LEARNER_DATA_DIR / "
        "_CONFIG_DIR / _CACHE_DIR to override explicitly.",
        resolved,
        stable,
    )
    return stable


def get_data_dir() -> Path:
    """Root directory for runtime data: DB, uploads.

    Resolution order:
    1. ``ADAPTIVE_LEARNER_DATA_DIR`` env var (tests, Docker, admin override)
    2. ``platformdirs.user_data_dir(APP_NAME)``:
       - Linux/macOS: ``~/.local/share/adaptive_learner``
       - Windows: ``%LOCALAPPDATA%\\adaptive_learner``
       - Tests: a tmp dir (set by ``backend/tests/conftest.py``).
    """
    if env_dir := os.environ.get("ADAPTIVE_LEARNER_DATA_DIR"):
        return Path(env_dir).expanduser().resolve()
    return _strip_snap_sandbox(Path(user_data_dir(APP_NAME)).resolve())


def get_config_dir() -> Path:
    """Config / secrets directory.

    Resolution order:
    1. ``ADAPTIVE_LEARNER_CONFIG_DIR`` env var
    2. ``platformdirs.user_config_dir(APP_NAME)``:
       - Linux/macOS: ``~/.config/adaptive_learner``
       - Windows: ``%APPDATA%\\adaptive_learner``

    Existing override chain for ``secrets.yaml`` (see
    ``docs/configuration.md``) already targets ``~/.config/adaptive_learner/``;
    this helper just makes the canonical path discoverable next to
    the data and cache resolvers.
    """
    if env_dir := os.environ.get("ADAPTIVE_LEARNER_CONFIG_DIR"):
        return Path(env_dir).expanduser().resolve()
    return _strip_snap_sandbox(Path(user_config_dir(APP_NAME)).resolve())


def get_cache_dir() -> Path:
    """Cache directory: transient artifacts, derived data.

    Resolution order:
    1. ``ADAPTIVE_LEARNER_CACHE_DIR`` env var
    2. ``platformdirs.user_cache_dir(APP_NAME)``:
       - Linux/macOS: ``~/.cache/adaptive_learner``
       - Windows: ``%LOCALAPPDATA%\\adaptive_learner\\Cache``

    Consumed by ``services/content_backup`` for the API-mode
    content-loader snapshots (``get_cache_dir()/content-loader/``).
    """
    if env_dir := os.environ.get("ADAPTIVE_LEARNER_CACHE_DIR"):
        return Path(env_dir).expanduser().resolve()
    return _strip_snap_sandbox(Path(user_cache_dir(APP_NAME)).resolve())


def get_upload_dir() -> Path:
    """Upload directory for cover images + article assets.

    Always resolved fresh - never cache the result at module import
    time. Test fixtures setting ``ADAPTIVE_LEARNER_DATA_DIR`` after
    ``app.*`` import still take effect.
    """
    return get_data_dir() / "uploads"


def get_db_path() -> Path:
    """SQLite database file path.

    Returns ``<get_data_dir()>/adaptive_learner.db``. ``database.py`` calls
    this helper as the default fallback when ``DATABASE_URL`` is not
    set; ``ADAPTIVE_LEARNER_DATA_DIR`` controls the resulting location via
    ``get_data_dir()``. The legacy ``ADAPTIVE_LEARNER_DB_PATH`` env var was
    removed as a path override in v0.30.0 (DEP-DBPATH-01 step 3).
    """
    return get_data_dir() / "adaptive_learner.db"


def mark_data_dir_as_production() -> None:
    """Write the ``.adaptive-learner-production`` marker into the data dir.

    Called once from the FastAPI lifespan startup. Skipped when the
    process is running in test mode (``ADAPTIVE_LEARNER_TEST=1``); the
    conftest tripwire treats the presence of this marker file as a
    fatal abort signal, so writing it during tests would defeat the
    isolation the marker is meant to enforce.
    """
    if os.environ.get("ADAPTIVE_LEARNER_TEST") == "1":
        return

    data_dir = get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    marker = data_dir / PRODUCTION_MARKER_FILENAME

    if marker.exists():
        return

    marker.write_text(
        "This directory contains production AdaptiveLearner data.\n"
        "Do NOT delete this file. It protects against accidental\n"
        "data loss caused by test runs (see backend/tests/conftest.py).\n",
        encoding="utf-8",
    )
