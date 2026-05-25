"""Generic plugin-settings round-trip endpoint (v1.26.0 / BL-30 commit 6).

Backstops the architecture rule "every non-``# INTERNAL``
plugin setting MUST be editable in the plugin UI". Until this
landed, every plugin's settings YAML was hand-edited only —
the rule was widely violated. The endpoint reads + writes
``backend/config/plugins/{plugin_name}.yaml`` and reloads the
plugin's in-memory config so the new values take effect on
the very next request.

Plugins opt in implicitly: any plugin registered with the
manager + having a YAML at the canonical path is editable.
No allow-list — the contract is symmetric for all plugins.

  GET   /api/plugin-settings/{plugin_name}      → {settings: {...}}
  PATCH /api/plugin-settings/{plugin_name}      → updates the YAML
                                                  + reloads
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.exceptions import NotFoundError, ValidationError
from app.paths import get_config_dir

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


def _plugin_config_path(plugin_name: str) -> Path:
    """Resolve the canonical config path for ``plugin_name``.

    The path comes from PluginForge's ``config_dir`` setting in
    ``app.yaml`` (default ``config/plugins``). Resolved relative
    to the backend's data dir via ``app.paths.get_config_dir``.
    """

    _validate_plugin_name(plugin_name)
    return get_config_dir() / "plugins" / f"{plugin_name}.yaml"


def _read_settings(plugin_name: str) -> dict[str, Any]:
    path = _plugin_config_path(plugin_name)
    if not path.exists():
        # Not a 404 — the plugin may just not ship a YAML. Empty
        # settings is the right answer per the lessons-learned
        # "PluginForge config not found → empty defaults".
        return {}
    with path.open("r", encoding="utf-8") as fh:
        loaded = yaml.safe_load(fh) or {}
    if not isinstance(loaded, dict):
        raise ValidationError(f"Config file {path} did not parse to a mapping.")
    settings = loaded.get("settings")
    if settings is None:
        return {}
    if not isinstance(settings, dict):
        raise ValidationError(f"Config file {path}: ``settings`` is not a mapping.")
    return settings


def _write_settings(plugin_name: str, settings: dict[str, Any]) -> None:
    """Rewrite the plugin's YAML in place, preserving any
    non-``settings`` top-level keys (rare, but PluginForge
    allows them). Comments are NOT preserved — PyYAML drops
    them on load. Acceptable trade-off because the settings
    files don't carry load-bearing comments (the canonical
    documentation lives in the .example template alongside)."""

    path = _plugin_config_path(plugin_name)
    if path.exists():
        with path.open("r", encoding="utf-8") as fh:
            loaded = yaml.safe_load(fh) or {}
    else:
        loaded = {}
        path.parent.mkdir(parents=True, exist_ok=True)
    if not isinstance(loaded, dict):
        loaded = {}
    loaded["settings"] = settings
    with path.open("w", encoding="utf-8") as fh:
        yaml.safe_dump(loaded, fh, default_flow_style=False, sort_keys=False)


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
    """Return the on-disk ``settings:`` block for ``plugin_name``."""

    _validate_plugin_name(plugin_name)
    return PluginSettingsResponse(
        plugin=plugin_name,
        settings=_read_settings(plugin_name),
    )


@router.patch("/{plugin_name}", response_model=PluginSettingsResponse)
def update_plugin_settings(plugin_name: str, body: PluginSettingsUpdate) -> PluginSettingsResponse:
    """Replace the ``settings:`` block with ``body.settings``.

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

    _write_settings(plugin_name, body.settings)
    _reload_plugin_in_memory(plugin_name, body.settings)
    logger.info(
        "Plugin %r settings updated (keys: %s)",
        plugin_name,
        sorted(body.settings),
    )
    return PluginSettingsResponse(plugin=plugin_name, settings=body.settings)
