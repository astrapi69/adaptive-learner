"""Generic plugin-settings round-trip endpoint (v1.26.0 / BL-30 commit 6).

Backstops the architecture rule "every non-``# INTERNAL``
plugin setting MUST be editable in the plugin UI". GET returns the
effective settings (bundled defaults merged with the user overlay,
``app.config_overlay.read_plugin_settings_merged``); PATCH stores the
delta in the user overlay and reloads the plugin's in-memory config.
PluginForge activation reads the same merged config
(``app.main.AdaptiveLearnerPluginManager``), so a saved value also
survives a restart (#3370).

Plugins opt in implicitly: any plugin registered with the
manager + having a YAML at the canonical path is editable.
No allow-list — the contract is symmetric for all plugins.

  GET   /api/plugin-settings/{plugin_name}      → {settings: {...}}
  PATCH /api/plugin-settings/{plugin_name}      → writes the delta
                                                  + reloads
"""

from __future__ import annotations

import logging
import re
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.config_overlay import read_plugin_settings_merged, write_user_plugin_settings
from app.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/plugin-settings", tags=["plugin-settings"])
logger = logging.getLogger(__name__)

# Plugin names follow the kebab-case identifier rule from
# architecture.md (lowercase letters, digits, hyphens only).
_PLUGIN_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


class PluginSettingsResponse(BaseModel):
    """GET /plugin-settings/{plugin_name} body."""

    plugin: str
    settings: dict[str, Any] = Field(default_factory=dict)


class PluginSettingsUpdate(BaseModel):
    """PATCH /plugin-settings/{plugin_name} body."""

    settings: dict[str, Any]


def _validate_plugin_name(plugin_name: str) -> None:
    if not _PLUGIN_NAME_RE.match(plugin_name):
        raise ValidationError(f"Plugin name {plugin_name!r} is not a valid identifier.")


def _reload_plugin_in_memory(plugin_name: str, settings: dict[str, Any]) -> None:
    """Mutate the plugin manager's in-memory ``plugin.config``
    so the new values take effect on the very next request.

    Lazy import of ``app.main.manager`` avoids the
    backend-startup cycle. A missing plugin is non-fatal: the
    YAML write still landed, and the next process boot picks it
    up via PluginForge's normal config-load path.
    """

    from app.main import manager

    plugin = manager.get_plugin(plugin_name)
    if plugin is None:
        logger.warning("Plugin %r not registered; in-memory reload skipped.", plugin_name)
        return
    config = getattr(plugin, "config", None)
    if not isinstance(config, dict):
        plugin.config = {"settings": settings}
        return
    config["settings"] = settings


@router.get("/{plugin_name}", response_model=PluginSettingsResponse)
def get_plugin_settings(plugin_name: str) -> PluginSettingsResponse:
    """Return the effective ``settings:`` block for ``plugin_name``."""

    _validate_plugin_name(plugin_name)
    return PluginSettingsResponse(
        plugin=plugin_name,
        settings=read_plugin_settings_merged(plugin_name),
    )


@router.patch("/{plugin_name}", response_model=PluginSettingsResponse)
def update_plugin_settings(plugin_name: str, body: PluginSettingsUpdate) -> PluginSettingsResponse:
    """Save ``body.settings`` as the plugin's settings.

    The user overlay stores only what differs from the bundled
    defaults; a key left out of the body falls back to its default.

    Validates the plugin is registered to surface typos quickly
    (``learning-repos`` → 404). The write itself is YAML-shape-
    only — no per-key schema enforcement at this layer; the
    plugin must tolerate the values it reads back. Per-plugin
    Pydantic validation is a future enhancement.
    """

    _validate_plugin_name(plugin_name)

    from app.main import manager

    if manager.get_plugin(plugin_name) is None:
        raise NotFoundError(f"Plugin {plugin_name!r} is not registered.")

    write_user_plugin_settings(plugin_name, body.settings)
    # The same call PluginForge makes at activation, so the reloaded
    # config is exactly what the next restart hands the plugin (#3370).
    loaded = manager.get_plugin_config(plugin_name).get("settings")
    effective = dict(loaded) if isinstance(loaded, dict) else {}
    _reload_plugin_in_memory(plugin_name, effective)
    logger.info(
        "Plugin %r settings updated (keys: %s)",
        plugin_name,
        sorted(body.settings),
    )
    return PluginSettingsResponse(plugin=plugin_name, settings=effective)
