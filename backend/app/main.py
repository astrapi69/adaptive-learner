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
- Global exception handler + CORS + security headers (CSP et al.).
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

from app import __version__, config_overlay
from app.database import init_db
from app.exceptions import AdaptiveLearnerError, NotFoundError
from app.hookspecs import AdaptiveLearnerHookSpec
from app.logging_config import setup_logging
from app.middleware.rate_limit import (
    RateLimiter,
    RateLimitMiddleware,
    load_rate_limit_config,
    rate_limiting_enabled,
    resolve_exempt_ips,
)
from app.openapi_metadata import OPENAPI_TAGS, ensure_route_metadata
from app.routers.backup import router as backup_router
from app.routers.content import router as content_router
from app.routers.curriculum import (
    curricula_router,
    lessons_router,
    topics_router,
    users_curricula_router,
)
from app.routers.element_errors import router as element_errors_router
from app.routers.export import router as export_router
from app.routers.github import router as github_router
from app.routers.help import router as help_router
from app.routers.identity import router as identity_router
from app.routers.imports import imports_router, users_imports_router
from app.routers.lesson_progress import router as lesson_progress_router
from app.routers.projects import projects_router, users_projects_router
from app.routers.reset import router as reset_router
from app.routers.settings import router as settings_router
from app.routers.sync import router as sync_router
from app.routers.system import router as system_router
from app.routers.taxonomy import (
    projects_taxonomy_router,
    subjects_router,
    tags_router,
    users_tags_router,
)
from app.routers.users import router as users_router
from app.services import crypto as crypto_service

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

# Backend port. Resolution order: ``ADAPTIVE_LEARNER_PORT`` env var >
# ``server.port`` in app.yaml > 18001 default. Uvicorn still picks the
# port from its own CLI flag; this constant exists so other code
# paths (Docker healthcheck, openapi server-url metadata, eventual
# self-hosted reverse-proxy hint) read the same value.
DEFAULT_BACKEND_PORT = 18001
DEFAULT_FRONTEND_PORT = 15174


def _get_user_override_path() -> Path:
    """Path to the ``secrets.yaml`` overlay.

    Single source of truth: resolved via :func:`app.paths.get_config_dir`
    so the production path (platformdirs / XDG) AND the
    ``ADAPTIVE_LEARNER_CONFIG_DIR`` test override agree everywhere the
    secrets file is read or written (layered config, the key resolver,
    ``secrets_service``, ``reset_service``). The previous hand-rolled
    XDG/APPDATA duplication is gone.
    """
    from app.paths import get_config_dir

    return get_config_dir() / "secrets.yaml"


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


# Env-var -> dotted config path. Drives ``_apply_env_overrides``
# (env beats yaml on the merged config view) and the inverse
# ``_hydrate_env_from_config`` (yaml fills the env when env is
# empty, so downstream env-only readers see the value too).
#
# Phase 34 (v1.20.0) — populate the AI-provider entries so the
# ``~/.config/adaptive_learner/secrets.yaml`` file-based config
# flow works for the desktop launcher. Bibliogon parity in shape;
# adaptive-learner has 3 providers vs Bibliogon's 1, plus per-
# provider ``default_model`` overrides.
_ENV_SECRET_OVERRIDES: dict[str, tuple[str, ...]] = {
    "ADAPTIVE_LEARNER_ANTHROPIC_API_KEY": ("ai", "anthropic", "api_key"),
    "ADAPTIVE_LEARNER_OPENAI_API_KEY": ("ai", "openai", "api_key"),
    "ADAPTIVE_LEARNER_GEMINI_API_KEY": ("ai", "gemini", "api_key"),
    "ADAPTIVE_LEARNER_ANTHROPIC_DEFAULT_MODEL": ("ai", "anthropic", "default_model"),
    "ADAPTIVE_LEARNER_OPENAI_DEFAULT_MODEL": ("ai", "openai", "default_model"),
    "ADAPTIVE_LEARNER_GEMINI_DEFAULT_MODEL": ("ai", "gemini", "default_model"),
}


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


# Inverse direction of ``_ENV_SECRET_OVERRIDES``: when a module
# reads a value from ``os.environ`` directly (the crypto service,
# uvicorn's CLI flag, etc.) but the value lives in the layered
# config (typically ``~/.config/adaptive_learner/secrets.yaml``),
# this map says "populate the env var from the merged config when
# the env is empty". Lets the secrets-yaml + Fernet flow Just Work
# without every reader having to learn the layered config.
_ENV_CONFIG_SOURCES: dict[str, tuple[str, ...]] = {
    "ADAPTIVE_LEARNER_SECRET_KEY": ("secret_key",),
}


def _hydrate_env_from_config(config: dict[str, Any]) -> None:
    """Set env vars from the merged config when they're not already
    in the environment.

    Inverse of :func:`_apply_env_overrides`. An already-exported
    env var wins; we only fill what's missing. Non-string config
    values (None, dicts, etc.) are skipped silently — the env-only
    reader will then surface its own missing-value error.
    """
    for env_name, path in _ENV_CONFIG_SOURCES.items():
        if os.environ.get(env_name):
            continue
        cursor: Any = config
        for segment in path:
            if not isinstance(cursor, dict):
                cursor = None
                break
            cursor = cursor.get(segment)
        if isinstance(cursor, str) and cursor.strip():
            os.environ[env_name] = cursor


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


def _coerce_port(value: object) -> int | None:
    """Best-effort int conversion for a port string from env / yaml."""
    if value is None:
        return None
    try:
        port = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return port if 1 <= port <= 65535 else None


def resolve_backend_port(config: dict[str, Any] | None = None) -> int:
    """Resolve the backend port.

    Precedence (highest wins):
      1. ``ADAPTIVE_LEARNER_PORT`` env var
      2. ``server.port`` in the resolved app config
      3. ``DEFAULT_BACKEND_PORT`` (18001)

    Uvicorn still reads ``--port`` from its own CLI flag; this
    function exists so Docker healthchecks, openapi server-url
    metadata, and any reverse-proxy hint code can agree with what
    the deployer actually picked.
    """
    env_port = _coerce_port(os.environ.get("ADAPTIVE_LEARNER_PORT"))
    if env_port is not None:
        return env_port
    cfg = config if config is not None else _load_app_config()
    cfg_port = _coerce_port((cfg.get("server") or {}).get("port"))
    if cfg_port is not None:
        return cfg_port
    return DEFAULT_BACKEND_PORT


def resolve_cors_origins(config: dict[str, Any] | None = None) -> list[str]:
    """Resolve the CORS allow-list.

    Precedence (highest wins):
      1. ``ADAPTIVE_LEARNER_CORS_ORIGINS`` env var (comma-separated)
      2. ``server.cors_origins`` list in the resolved app config
      3. ``[f"http://localhost:{DEFAULT_FRONTEND_PORT}"]``

    The CLAUDE.md security rule "Secrets NEVER in committed config
    files" applies one level above this — the cors_origins list is
    not a secret, it's environment-shape config.
    """
    env_value = os.environ.get("ADAPTIVE_LEARNER_CORS_ORIGINS", "").strip()
    if env_value:
        return [o.strip() for o in env_value.split(",") if o.strip()]
    cfg = config if config is not None else _load_app_config()
    cfg_value = (cfg.get("server") or {}).get("cors_origins")
    if isinstance(cfg_value, list) and cfg_value:
        return [str(o).strip() for o in cfg_value if str(o).strip()]
    return [f"http://localhost:{DEFAULT_FRONTEND_PORT}"]


manager = PluginManager(
    config_path=str(CONFIG_PATH),
    api_version="1",
    # pluginforge v0.7.0+ identity gating. Plugins declare a
    # ``target_application`` class attribute; the manager filters
    # out anything that doesn't match. Keeps a host's plugin
    # registry isolated from third-party plugins built for a
    # different application that happen to share the
    # ``adaptive_learner.plugins`` entry-point group.
    app_id="adaptive_learner",
)
manager.register_hookspecs(AdaptiveLearnerHookSpec)

# Layer the user-overlay (Settings-UI plugin enable/disable lists)
# onto the manager's active app config. pluginforge v0.10.0+ exposes
# this as the public ``merge_app_config`` method; before v0.10.0 we
# assigned ``manager._app_config`` directly.
manager.merge_app_config(config_overlay.read_app_config_merged())

_startup_config = _load_app_config()
# Hydrate env vars whose canonical reader sits outside the layered
# config (crypto reads os.environ directly). Runs BEFORE the
# lifespan + before crypto.validate_at_startup so a key stored in
# ~/.config/adaptive_learner/secrets.yaml works without the
# deployer having to manually ``export`` it.
_hydrate_env_from_config(_startup_config)


def _bootstrap_secrets_template() -> None:
    """First-run: write a commented secrets template to
    ``~/.config/adaptive_learner/secrets.yaml`` and audit
    permissions. Best-effort; never fatal. Phase 34 (v1.20.0).

    Skipped under ``ADAPTIVE_LEARNER_TEST=1`` so test runs don't
    materialise a file in the developer's real config dir.
    """
    if os.environ.get("ADAPTIVE_LEARNER_TEST"):
        return
    try:
        from app.services.secrets_template import (
            audit_permissions,
            ensure_template_exists,
        )

        path = _get_user_override_path()
        ensure_template_exists(path)
        audit_permissions(path)
    except Exception:  # noqa: BLE001
        # The loader path tolerates a missing file; if the template
        # write fails for any reason the app continues with no
        # external secrets configured. Surfaced as a warning by
        # ``ensure_template_exists`` itself.
        logger.exception("Secrets template bootstrap failed; continuing.")


_bootstrap_secrets_template()


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
    from app import db_guard
    from app.data_dir_migration import migrate_data_dir_if_needed
    from app.paths import mark_data_dir_as_production

    # This IS the sanctioned application runtime: the app may write to
    # (and purge) its own production data dir. The db_guard only blocks
    # destructive statements from OTHER processes (ad-hoc scripts).
    db_guard.mark_app_runtime()
    migrate_data_dir_if_needed()
    mark_data_dir_as_production()
    init_db()

    # Fail-fast on a missing / malformed ADAPTIVE_LEARNER_SECRET_KEY.
    # Surfaces the misconfiguration here at boot, not from a random
    # POST /api/settings/.../api-key call hours later. See
    # app.services.crypto.validate_at_startup.
    crypto_service.validate_at_startup()

    # v1.48.x — migrate legacy DB-encrypted API keys into secrets.yaml,
    # re-encrypted under the now-stable machine-local secret.key. Keys
    # encrypted under a lost (volatile) key are cleared so the user
    # re-enters them once. Best-effort: a migration hiccup must not
    # block startup.
    try:
        from app.database import SessionLocal as _KeySessionLocal
        from app.services import secrets_service

        secrets_service.warn_if_permissions_too_open()
        with _KeySessionLocal() as _key_db:
            secrets_service.migrate_db_keys(_key_db)
    except Exception:  # noqa: BLE001
        logger.exception("API-key migration to secrets.yaml failed; continuing.")

    # v1.9.0 / Phase 22B — pre-seed the global Subject taxonomy.
    # Idempotent: subsequent runs are no-ops because the loader
    # matches by slug.
    try:
        from app.database import SessionLocal
        from app.services.subjects_seed import seed_subjects

        with SessionLocal() as _seed_db:
            summary = seed_subjects(_seed_db)
        logger.info(
            "Seed subjects: available=%d existing=%d inserted=%d",
            summary["available"],
            summary["existing"],
            summary["inserted"],
        )
    except Exception:  # noqa: BLE001
        # A seed failure must not block startup; the user can still
        # add subjects manually via the UI.
        logger.exception("Subject seeding failed; continuing without seed.")

    _load_installed_plugins()
    _log_plugin_diagnostics_pre(enabled_in_config=_enabled_plugins_from_config())
    manager.discover_plugins()
    manager.mount_routes(app)
    # Backfill OpenAPI tags + summaries on the freshly-mounted plugin
    # routes (idempotent; explicit decorator metadata is preserved).
    ensure_route_metadata(app)
    _log_plugin_diagnostics_post(
        active=[p.name for p in manager.get_active_plugins()],
        load_errors=dict(manager.get_load_errors()),
        enabled_in_config=_enabled_plugins_from_config(),
    )

    # v1.16.0 / Phase 29B — seed the badge catalog from the
    # gamification plugin's YAML bundle. Runs AFTER plugin
    # discovery so the plugin's module is importable. Idempotent
    # on the ``key`` slug; non-fatal on failure (the dashboard
    # showcase just renders empty).
    try:
        from adaptive_learner_gamification.badge_service import seed_catalog

        from app.database import SessionLocal as _BadgeSessionLocal

        with _BadgeSessionLocal() as _seed_db:
            inserted = seed_catalog(_seed_db)
        logger.info("Seed badges: inserted_or_updated=%d", inserted)
    except Exception:  # noqa: BLE001
        logger.exception("Badge seeding failed; continuing without seed.")

    yield
    logger.info("Shutting down Adaptive Learner")
    manager.deactivate_all()


app = FastAPI(
    title="Adaptive Learner API",
    description=(
        "API for the Adaptive Learner platform — an adaptive learning system "
        "built on the six-method learning model.\n\n"
        "**Authentication:** this is a single-user, local-first app; endpoints "
        "require no auth token. AI provider keys are stored encrypted "
        "(Fernet) and resolved through a three-layer chain "
        "(env > `~/.config/adaptive_learner/secrets.yaml` > DB).\n\n"
        "**Rate limiting:** AI / content / settings endpoints are rate-limited "
        "per client IP (see the `429` responses + `X-RateLimit-*` headers); "
        "localhost is exempt."
    ),
    version=__version__,
    lifespan=lifespan,
    openapi_tags=OPENAPI_TAGS,
    docs_url="/api/docs" if DEBUG else None,
    redoc_url="/api/redoc" if DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=resolve_cors_origins(_startup_config),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Per-IP, per-tier API rate limiting (protects AI-credit-burning
# endpoints from abusive / runaway clients). Switches live on
# ``app.state`` so they can be inspected / overridden; tiers come from
# config/rate_limits.yaml + RATE_LIMIT_* env overrides. Localhost is
# exempt and test mode is off unless RATE_LIMIT_ENABLED=1 forces it on.
app.state.rate_limiter = RateLimiter(load_rate_limit_config())
app.state.rate_limit_enabled = rate_limiting_enabled()
app.state.rate_limit_exempt = resolve_exempt_ips()
app.add_middleware(RateLimitMiddleware)

# Security headers (defense-in-depth; Phase 61 audit P3 "no CSP header
# anywhere"). The backend is API-only -- it serves JSON, never an SPA --
# so a strict, deny-everything CSP is safe for normal responses (CSP on
# a JSON response does not constrain the separate page that fetched it;
# it only hardens the rare case of a response being opened directly in a
# browser). The DEBUG-only Swagger / ReDoc UI is the one exception: it is
# real HTML that loads scripts + styles from a CDN and inline, so those
# paths get a relaxed policy instead of the strict default.
_DOCS_PATHS = frozenset({"/api/docs", "/api/redoc", "/openapi.json"})
_STRICT_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
_DOCS_CSP = (
    "default-src 'self'; "
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "img-src 'self' https://fastapi.tiangolo.com data:; "
    "font-src 'self' https://cdn.jsdelivr.net; "
    "frame-ancestors 'none'"
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Attach defense-in-depth security headers to every response.

    Uses ``setdefault`` so a route that intentionally sets one of these
    (e.g. a future framable embed) is never clobbered. The CSP is the
    strict API policy except on the Swagger / ReDoc / OpenAPI paths,
    which need a CDN-aware policy to render.
    """
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    csp = _DOCS_CSP if request.url.path in _DOCS_PATHS else _STRICT_CSP
    response.headers.setdefault("Content-Security-Policy", csp)
    return response


# Phase 1C core routers. Mounted directly here (not via the plugin
# manager) — these are the foundation every plugin builds on. New
# routers land alongside their Phase-2+ plugins via
# ``manager.mount_routes(app)`` in the lifespan.
app.include_router(users_router, prefix="/api")
app.include_router(users_projects_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(identity_router, prefix="/api")
app.include_router(reset_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
from app.routers.plugin_settings import router as plugin_settings_router  # noqa: E402

app.include_router(plugin_settings_router, prefix="/api")
app.include_router(users_curricula_router, prefix="/api")
app.include_router(curricula_router, prefix="/api")
app.include_router(topics_router, prefix="/api")
app.include_router(lessons_router, prefix="/api")
app.include_router(users_imports_router, prefix="/api")
app.include_router(imports_router, prefix="/api")
app.include_router(lesson_progress_router, prefix="/api")
app.include_router(element_errors_router, prefix="/api")
app.include_router(subjects_router, prefix="/api")
app.include_router(tags_router, prefix="/api")
app.include_router(users_tags_router, prefix="/api")
app.include_router(projects_taxonomy_router, prefix="/api")
app.include_router(sync_router, prefix="/api")
app.include_router(system_router, prefix="/api")
app.include_router(backup_router, prefix="/api")
app.include_router(content_router, prefix="/api")
app.include_router(export_router, prefix="/api")
app.include_router(github_router, prefix="/api")
app.include_router(help_router, prefix="/api")

# Backfill OpenAPI tags + summaries on the core routers now; plugin
# routes are backfilled in the lifespan after they mount.
ensure_route_metadata(app)


@app.exception_handler(AdaptiveLearnerError)
async def adaptive_learner_error_handler(request: Request, exc: AdaptiveLearnerError):
    """Map typed domain errors to HTTP responses (per code-hygiene.md).

    In ``DEBUG`` mode, 5xx responses additionally carry
    ``stacktrace`` / ``endpoint`` / ``method`` so the frontend
    error-report dialog can pre-fill a GitHub issue body with
    actionable context. 4xx stay clean (they are not bugs and the
    extra payload would only add noise to the toast).
    """
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
    content: dict[str, Any] = {"detail": exc.detail}
    if exc.extra:
        # Merge subclass-supplied context fields (e.g. existing_id
        # on a 409 duplicate-import) into the response body so the
        # frontend can act on the error without parsing prose.
        content.update(exc.extra)
    if DEBUG and exc.status_code >= 500:
        import traceback

        content["stacktrace"] = "".join(
            traceback.format_exception(type(exc), exc, exc.__traceback__)
        )
        content["endpoint"] = request.url.path
        content["method"] = request.method
    return JSONResponse(status_code=exc.status_code, content=content)


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


@app.get(
    "/api/health",
    tags=["System"],
    summary="Health check",
    description=(
        "Liveness probe for monitoring. Never rate-limited. Returns the "
        "running version + debug flag."
    ),
    response_description="Service status, version, and debug flag.",
)
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


@app.get("/api/plugins/inspect/{name}")
def inspect_plugin(name: str) -> dict[str, Any]:
    """PluginForge v0.9.0 lifecycle visibility for the Settings UI.

    Exposes a single plugin's lifecycle metadata so the
    ``Settings → Plugins`` row can show when it was last
    activated and when its config last changed. 404 when the
    discovery layer doesn't know the name.
    """
    inspection = manager.inspect_plugin(name)
    if inspection is None:
        raise NotFoundError(f"Plugin {name!r} not found.")
    state = inspection.state
    return {
        "name": inspection.name,
        "version": inspection.version,
        "target_application": inspection.target_application,
        "state": {
            "activated": state.activated,
            "activated_at": (
                state.activated_at.isoformat() if state.activated_at is not None else None
            ),
            "last_config_change": (
                state.last_config_change.isoformat()
                if state.last_config_change is not None
                else None
            ),
            "source": state.source,
            "filter_reason": state.filter_reason,
            "load_error": (str(state.load_error) if state.load_error is not None else None),
        },
    }
