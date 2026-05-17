"""Adaptive Learner FastAPI application.

Skeleton state (Phase 1A). The Bibliogon EXAMPLE-DOMAIN routers,
services, models, AI module, licensing, voice store and body-size
middleware have been removed. What remains:

- Layered config loader (project YAML < user overlay < secrets
  override < env-vars). Mechanism stays; the env-var allow-list
  starts empty until a new plugin registers a secret of its own.
- PluginForge bootstrap (manager + hookspecs registration +
  discover-and-mount during lifespan).
- Filesystem isolation (data-dir migration + production marker).
- Global exception handler + CORS.
- Minimal endpoints: ``/api/health``, ``/api/i18n/{lang}``,
  ``/api/plugins/manifests``, ``/api/plugins/health``,
  ``/api/plugins/errors``.

Core CRUD routers (users, projects, settings) land in Phase 1C.
Plugin routes mount via PluginForge starting Phase 3.
"""

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import yaml
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pluginforge import PluginManager
from pluginforge.config import load_i18n

from app import __version__
from app.database import init_db
from app.exceptions import AdaptiveLearnerError
from app.hookspecs import AdaptiveLearnerHookSpec
from app.logging_config import setup_logging

setup_logging()
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "config" / "app.yaml"
CONFIG_EXAMPLE_PATH = BASE_DIR / "config" / "app.yaml.example"

if not CONFIG_PATH.exists() and CONFIG_EXAMPLE_PATH.exists():
    import shutil

    shutil.copy2(CONFIG_EXAMPLE_PATH, CONFIG_PATH)
    logger.info("Created config/app.yaml from app.yaml.example")

DEBUG = os.getenv("ADAPTIVE_LEARNER_DEBUG", "true").lower() in ("true", "1", "yes")
CORS_ORIGINS = os.getenv(
    "ADAPTIVE_LEARNER_CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
)


def _get_user_override_path() -> Path:
    """User-home secrets-override file path (XDG-conformant)."""
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA")
        base = Path(appdata) if appdata else Path.home() / "AppData" / "Roaming"
        return base / "adaptive_learner" / "secrets.yaml"
    xdg_config = os.environ.get("XDG_CONFIG_HOME")
    base = Path(xdg_config) if xdg_config else Path.home() / ".config"
    return base / "adaptive_learner" / "secrets.yaml"


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """Override-wins deep merge; lists REPLACE."""
    out: dict[str, Any] = dict(base)
    for key, override_value in override.items():
        base_value = out.get(key)
        if isinstance(base_value, dict) and isinstance(override_value, dict):
            out[key] = _deep_merge(base_value, override_value)
        else:
            out[key] = override_value
    return out


# Env-var -> dotted config path. Empty in the skeleton; plugins
# register their own secrets here as they land (Phase 3+).
_ENV_SECRET_OVERRIDES: dict[str, tuple[str, ...]] = {}


def _apply_env_overrides(config: dict[str, Any]) -> dict[str, Any]:
    out = dict(config)
    for env_name, path in _ENV_SECRET_OVERRIDES.items():
        env_value = os.environ.get(env_name)
        if not env_value:
            continue
        cursor: dict[str, Any] = out
        for segment in path[:-1]:
            existing = cursor.get(segment)
            cursor[segment] = dict(existing) if isinstance(existing, dict) else {}
            cursor = cursor[segment]
        cursor[path[-1]] = env_value
    return out


def _load_override_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        with path.open(encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except (yaml.YAMLError, OSError) as exc:
        logger.warning(
            "Could not read override file %s: %s. Continuing with project config only.",
            path,
            exc,
        )
        return {}
    if data is None:
        return {}
    if not isinstance(data, dict):
        logger.warning(
            "Override file %s top-level is %s, expected mapping. "
            "Continuing with project config only.",
            path,
            type(data).__name__,
        )
        return {}
    return data


def _load_app_config() -> dict[str, Any]:
    """Read app.yaml + user overlay + secrets override + env-vars."""
    from app import config_overlay

    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            project = yaml.safe_load(f) or {}
    except Exception:
        project = {}
    user_overlay = config_overlay._read_yaml(config_overlay._user_app_path())
    override = _load_override_file(_get_user_override_path())
    merged = _deep_merge(project, user_overlay)
    merged = _deep_merge(merged, override)
    return _apply_env_overrides(merged)


manager = PluginManager(
    config_path=str(CONFIG_PATH),
    api_version="1",
)
try:
    manager.register_hookspecs(AdaptiveLearnerHookSpec)
except ValueError:
    # Skeleton-state Phase 1A: AdaptiveLearnerHookSpec is empty and
    # pluggy refuses to register a class with zero @hookspec methods.
    # Phase 2 adds real hooks and removes this try/except.
    logger.debug("Skipping hookspec registration: no hooks defined yet")


def _sync_manager_with_overlay() -> None:
    """Patch ``manager._app_config`` so user-overlay enable/disable
    lists are honoured. Pluginforge reads its app config from
    ``_config_path`` directly; we layer user-overlay on top.
    """
    from app import config_overlay

    merged = config_overlay.read_app_config_merged()
    try:
        manager._app_config = merged  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001
        logger.warning(
            "Could not patch PluginManager._app_config with overlay view; "
            "Settings-UI changes will not take effect until next restart."
        )


_sync_manager_with_overlay()
_startup_config = _load_app_config()


def _load_installed_plugins() -> None:
    """Add bundled and ZIP-installed plugin dirs to ``sys.path``."""
    installed_dir = BASE_DIR / "plugins" / "installed"
    if installed_dir.exists():
        for plugin_dir in installed_dir.iterdir():
            if plugin_dir.is_dir() and (plugin_dir / "plugin.yaml").exists():
                path_str = str(plugin_dir)
                if path_str not in sys.path:
                    sys.path.insert(0, path_str)

    bundled_dir = BASE_DIR.parent / "plugins"
    if bundled_dir.exists():
        for plugin_dir in bundled_dir.iterdir():
            if plugin_dir.is_dir() and plugin_dir.name.startswith("adaptive-learner-plugin-"):
                path_str = str(plugin_dir)
                if path_str not in sys.path:
                    sys.path.insert(0, path_str)


def _enabled_plugins_from_config() -> list[str]:
    return list(_startup_config.get("plugins", {}).get("enabled") or [])


def _discovered_entry_points() -> list[str]:
    try:
        from importlib.metadata import entry_points

        return sorted(ep.name for ep in entry_points(group="adaptive_learner.plugins"))
    except Exception:  # noqa: BLE001
        return []


def _log_plugin_diagnostics_pre(*, enabled_in_config: list[str]) -> None:
    discovered = _discovered_entry_points()
    logger.info(
        "Plugin discovery: %d entry points found via 'adaptive_learner.plugins' group: %s",
        len(discovered),
        ", ".join(discovered) if discovered else "none",
    )
    logger.info(
        "Plugins enabled in config (%d): %s",
        len(enabled_in_config),
        ", ".join(enabled_in_config) if enabled_in_config else "none",
    )


def _log_plugin_diagnostics_post(
    *,
    active: list[str],
    load_errors: dict[str, object],
    enabled_in_config: list[str],
) -> None:
    logger.info(
        "Plugins loaded (%d/%d enabled): %s",
        len(active),
        len(enabled_in_config),
        ", ".join(active) if active else "none",
    )
    for plugin_name, err in load_errors.items():
        logger.warning("Plugin '%s' failed to load: %s", plugin_name, err)
    missing = set(enabled_in_config) - set(active) - set(load_errors)
    if missing:
        logger.warning(
            "Plugins enabled in config but not loaded: %s. "
            "If this is unexpected, rebuild the container or re-run `poetry install`.",
            ", ".join(sorted(missing)),
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Adaptive Learner (debug=%s)", DEBUG)
    from app.data_dir_migration import migrate_data_dir_if_needed
    from app.paths import mark_data_dir_as_production

    migrate_data_dir_if_needed()
    mark_data_dir_as_production()
    init_db()

    _load_installed_plugins()
    _log_plugin_diagnostics_pre(enabled_in_config=_enabled_plugins_from_config())
    manager.discover_plugins()
    manager.mount_routes(app)
    _log_plugin_diagnostics_post(
        active=[p.name for p in manager.get_active_plugins()],
        load_errors=dict(manager.get_load_errors()),
        enabled_in_config=_enabled_plugins_from_config(),
    )

    yield
    logger.info("Shutting down Adaptive Learner")
    manager.deactivate_all()


app = FastAPI(
    title="Adaptive Learner",
    description="Adaptive learning system based on the six-method learning model.",
    version=__version__,
    lifespan=lifespan,
    docs_url="/api/docs" if DEBUG else None,
    redoc_url="/api/redoc" if DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.exception_handler(AdaptiveLearnerError)
async def adaptive_learner_error_handler(request: Request, exc: AdaptiveLearnerError):
    """Map typed domain errors to HTTP responses (per code-hygiene.md)."""
    if exc.status_code >= 500:
        logger.error(
            "%s %s -> %s",
            request.method,
            request.url.path,
            exc.detail,
            exc_info=exc,
        )
    else:
        logger.warning(
            "%s %s -> %s %s",
            request.method,
            request.url.path,
            exc.status_code,
            exc.detail,
        )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback

    logger.error(
        "Unhandled error: %s %s -> %s",
        request.method,
        request.url.path,
        str(exc),
        exc_info=True,
    )
    detail: dict[str, Any] = {"detail": str(exc)}
    if DEBUG:
        detail["stacktrace"] = traceback.format_exc()
        detail["endpoint"] = request.url.path
        detail["method"] = request.method
    return JSONResponse(status_code=500, content=detail)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": __version__, "debug": DEBUG}


@app.get("/api/i18n/{lang}")
def get_i18n(lang: str) -> dict[str, Any]:
    return dict(load_i18n(BASE_DIR / "config", lang))


@app.get("/api/plugins/manifests")
def get_plugin_manifests() -> dict[str, Any]:
    result: dict[str, Any] = {}
    for plugin in manager.get_active_plugins():
        manifest = plugin.get_frontend_manifest()
        if manifest:
            result[plugin.name] = manifest
    return result


@app.get("/api/plugins/health")
def get_plugin_health() -> dict[str, Any]:
    return dict(manager.health_check())


@app.get("/api/plugins/errors")
def get_plugin_errors() -> dict[str, str]:
    return dict(manager.get_load_errors())
