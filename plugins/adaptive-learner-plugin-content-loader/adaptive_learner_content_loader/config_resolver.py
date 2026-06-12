"""Resolve plugin settings + the optional GitHub token
(Phase 43 / EXP-002 / 2C-wire).

The plugin settings YAML at
``backend/config/plugins/content-loader.yaml`` is the canonical
source for the configured content sources. The optional token
for private repos goes through the three-layer secrets chain
documented in CLAUDE.md:

  env (ADAPTIVE_LEARNER_GITHUB_TOKEN)
    > ~/.config/adaptive_learner/secrets.yaml (key
      ``content_loader.github_token``)
    > Fernet-encrypted DB column (NOT IMPLEMENTED in v1.27.0
      — the loader respects None and falls back to tokenless
      requests; the DB-encrypted layer ships with the rest
      of the secrets work in a future phase)

This module is pure stdlib + pyyaml. The plugin's
``plugin.py`` calls it on activation; the routes call it on
every request so a user editing the YAML mid-session takes
effect without a backend restart.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

ENV_TOKEN_VAR = "ADAPTIVE_LEARNER_GITHUB_TOKEN"
PLUGIN_SETTINGS_FILENAME = "content-loader.yaml"


def _resolve_plugin_settings_path() -> Path | None:
    """Best-effort lookup for the plugin settings YAML.

    Three candidates in order:
    1. ``$ADAPTIVE_LEARNER_DATA_DIR/config/plugins/content-loader.yaml``
       — Phase 2 filesystem isolation override; the production
       data dir.
    2. ``app.paths.get_config_dir() / "plugins" / "content-loader.yaml"``
       — the canonical production location when ``app.paths``
       is importable (running inside the backend).
    3. ``backend/config/plugins/content-loader.yaml`` relative
       to the repo root — pure-plugin tests that don't have
       the backend on sys.path.

    Returns None when none of the candidates exists; the caller
    falls back to in-code defaults.
    """
    data_dir_override = os.environ.get("ADAPTIVE_LEARNER_DATA_DIR")
    if data_dir_override:
        candidate = Path(data_dir_override) / "config" / "plugins" / PLUGIN_SETTINGS_FILENAME
        if candidate.is_file():
            return candidate

    try:
        from app.paths import get_config_dir  # type: ignore[import-not-found]

        candidate = get_config_dir() / "plugins" / PLUGIN_SETTINGS_FILENAME
        if candidate.is_file():
            return candidate
    except Exception:
        # app not importable (pure plugin test, or import
        # ordering issue). Fall through to the repo-relative
        # search.
        pass

    here = Path(__file__).resolve()
    # plugin pkg → plugin dir → plugins/ → repo root
    for parent in here.parents[:5]:
        candidate = parent / "backend" / "config" / "plugins" / PLUGIN_SETTINGS_FILENAME
        if candidate.is_file():
            return candidate
    return None


def read_plugin_settings() -> dict[str, Any]:
    """Read the plugin's settings section from the YAML.

    Returns ``{}`` when the file is missing OR malformed —
    callers fall back to defaults rather than crash. The
    plugin must never refuse to load over a typo in the YAML.
    """
    path = _resolve_plugin_settings_path()
    if path is None:
        logger.debug(
            "content-loader: settings YAML not found; using defaults",
        )
        return {}
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as err:
        logger.warning(
            "content-loader: settings YAML malformed at %s: %s",
            path,
            err,
        )
        return {}
    if not isinstance(raw, dict):
        return {}
    settings = raw.get("settings")
    if not isinstance(settings, dict):
        return {}
    return settings


def _read_secrets_yaml() -> dict[str, Any]:
    """Best-effort read of ``~/.config/adaptive_learner/secrets.yaml``.

    Each top-level key namespaces a plugin's secrets; we read
    only ``content_loader.*``.
    """
    candidates = [
        Path.home() / ".config" / "adaptive_learner" / "secrets.yaml",
    ]
    for candidate in candidates:
        if not candidate.is_file():
            continue
        try:
            raw = yaml.safe_load(candidate.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                return raw
        except yaml.YAMLError as err:  # pragma: no cover - defensive
            logger.warning("Ignoring malformed secrets file %s: %s", candidate, err)
            continue
    return {}


def resolve_github_token(settings: dict[str, Any] | None = None) -> str | None:
    """Resolve the optional GitHub token via the three-layer chain.

    1. ``ADAPTIVE_LEARNER_GITHUB_TOKEN`` env var
    2. ``content_loader.github_token`` in
       ``~/.config/adaptive_learner/secrets.yaml``
    3. Fernet-encrypted DB column (deferred; returns None
       here so the public-repo path keeps working)

    Returns None when no token is configured — the GitHub
    adapter then makes unauthenticated requests, which is
    the right default for the canonical pilot repo
    (astrapi69/adaptive-learner-content is public).

    ``settings`` is accepted for forward-compat (a future
    YAML field could pin a per-source token); ignored in
    v1.27.0 to keep the secrets surface narrow.
    """
    env_token = os.environ.get(ENV_TOKEN_VAR)
    if env_token:
        return env_token

    secrets = _read_secrets_yaml()
    content_loader_secrets = secrets.get("content_loader")
    if isinstance(content_loader_secrets, dict):
        token = content_loader_secrets.get("github_token")
        if isinstance(token, str) and token:
            return token

    return None
