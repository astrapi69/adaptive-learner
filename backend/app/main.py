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
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from pluginforge import PluginManager
from pluginforge.config import load_i18n

from app import __version__, config_overlay
from app.config import (
    BASE_DIR,
    CONFIG_EXAMPLE_PATH,
    CONFIG_PATH,
    _hydrate_env_from_config,
    _load_app_config,
    resolve_cors_origins,
)
from app.exceptions import AdaptiveLearnerError, NotFoundError
from app.frontend_static import BodySizeLimitMiddleware
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
from app.routers.learning_data import router as learning_data_router
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
from app.startup import bootstrap_secrets_template, create_lifespan

setup_logging()
logger = logging.getLogger(__name__)

# app.yaml is gitignored; bootstrap it from the committed example on
# first run (after setup_logging so the message is formatted). The path
# constants + the config loaders live in app.config.
if not CONFIG_PATH.exists() and CONFIG_EXAMPLE_PATH.exists():
    import shutil

    shutil.copy2(CONFIG_EXAMPLE_PATH, CONFIG_PATH)
    logger.info("Created config/app.yaml from app.yaml.example")

DEBUG = os.getenv("ADAPTIVE_LEARNER_DEBUG", "false").lower() in ("true", "1", "yes")


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

# First-run secrets template (best-effort; skipped under test).
bootstrap_secrets_template()

# The lifespan factory captures the plugin manager + resolved config so
# app.startup never imports app.main (no cycle).
lifespan = create_lifespan(manager, _startup_config, debug=DEBUG)


app = FastAPI(
    title="Adaptive Learner API",
    description=(
        "API for the Adaptive Learner platform - an adaptive learning system "
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
    # /openapi.json stays PUBLIC in every mode - decided in #2279: the app
    # has no per-request auth, so gating the spec would be security theatre,
    # while the machine-readable description is an integration interface
    # (client generators). The interactive viewers below are a heavier
    # optional convenience and stay DEBUG-only (#2198). Pinned by
    # tests/test_openapi_docs.py::test_spec_public_while_viewers_debug_gated.
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

# Single-container parity (#2058): nginx used to enforce
# ``client_max_body_size 50M`` in front of the API and (in principle)
# response compression; with FastAPI serving the frontend directly, both
# live here. The limit matches the retired nginx value.
app.add_middleware(BodySizeLimitMiddleware, max_bytes=50 * 1024 * 1024)
app.add_middleware(GZipMiddleware, minimum_size=1024)

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
# anywhere"). API responses are JSON, so the strict deny-everything CSP
# is right for them. But since #2058 this backend ALSO serves the built
# SPA (single-container mode) - and shipping the API policy on those
# responses is a white page for every user (#2197, found the day v2.8.0
# first reached a device). Three response classes therefore: /api/* gets
# the strict policy, the Swagger/ReDoc paths get the CDN-aware docs
# policy, and everything else gets the SPA policy that
# ``frontend_static.mount_frontend_static`` computed from the real
# index.html - falling back to strict when no frontend is mounted.
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
    path = request.url.path
    if path in _DOCS_PATHS:
        csp = _DOCS_CSP
    elif path == "/api" or path.startswith("/api/"):
        csp = _STRICT_CSP
    else:
        csp = getattr(request.app.state, "spa_csp", None) or _STRICT_CSP
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
app.include_router(learning_data_router, prefix="/api")
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
