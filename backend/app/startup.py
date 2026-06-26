"""Application startup: secrets bootstrap, plugin loading, and the
FastAPI lifespan.

Extracted from ``app.main`` so the entrypoint module is the app wiring,
not the boot sequence. :func:`create_lifespan` is a factory: it captures
the ``PluginManager`` + resolved startup config + debug flag in a closure
so this module never imports ``app.main`` (no cycle).
"""

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from pluginforge import PluginManager

from app.config import BASE_DIR, _get_user_override_path
from app.database import init_db
from app.openapi_metadata import ensure_route_metadata
from app.services import crypto as crypto_service

logger = logging.getLogger(__name__)


def bootstrap_secrets_template() -> None:
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


def _enabled_plugins_from_config(startup_config: dict[str, Any]) -> list[str]:
    return list(startup_config.get("plugins", {}).get("enabled") or [])


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


def create_lifespan(manager: PluginManager, startup_config: dict[str, Any], *, debug: bool):
    """Build the FastAPI ``lifespan`` context manager.

    Captures the plugin ``manager`` + resolved ``startup_config`` + the
    ``debug`` flag in a closure so the lifespan can run the boot sequence
    (data-dir migration, DB init, key validation + migration, subject /
    badge seeding, plugin discover + mount) without this module importing
    ``app.main``.
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logger.info("Starting Adaptive Learner (debug=%s)", debug)
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
        _log_plugin_diagnostics_pre(enabled_in_config=_enabled_plugins_from_config(startup_config))
        manager.discover_plugins()
        manager.mount_routes(app)
        # Backfill OpenAPI tags + summaries on the freshly-mounted plugin
        # routes (idempotent; explicit decorator metadata is preserved).
        ensure_route_metadata(app)

        # Single-origin LAN device-test mode (``make dev-lan``): serve the
        # built frontend from the backend port so a phone in the same WLAN
        # can open one URL with no CORS hop. Gated by an env var so the
        # default dev flow / tests / Docker are untouched. Mounted HERE,
        # after every API + plugin route, so the ``/`` catch-all never
        # shadows ``/api/...``.
        if os.environ.get("ADAPTIVE_LEARNER_SERVE_FRONTEND"):
            from app.frontend_static import default_dist_dir, mount_frontend_static

            override = os.environ.get("ADAPTIVE_LEARNER_FRONTEND_DIST")
            mount_frontend_static(app, Path(override) if override else default_dist_dir())
        _log_plugin_diagnostics_post(
            active=[p.name for p in manager.get_active_plugins()],
            load_errors=dict(manager.get_load_errors()),
            enabled_in_config=_enabled_plugins_from_config(startup_config),
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

    return lifespan
