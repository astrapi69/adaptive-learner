"""Layered application configuration.

The config loader resolves project YAML < user overlay < secrets
override < env-vars into one merged view, plus the inverse
env-hydration (yaml fills the env when a downstream reader only looks at
``os.environ``). Extracted from ``app.main`` so the entrypoint module is
the FastAPI wiring, not the config plumbing.

Pure definitions only (no import-time side effects): ``app.main`` keeps
the first-run ``app.yaml`` bootstrap + the startup hydrate so the logging
setup order is preserved.
"""

import logging
import os
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "config" / "app.yaml"
CONFIG_EXAMPLE_PATH = BASE_DIR / "config" / "app.yaml.example"

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
    except (OSError, yaml.YAMLError, UnicodeDecodeError) as exc:
        logger.warning(
            "Could not read app.yaml at %s: %s. Continuing with overlay + env config only.",
            CONFIG_PATH,
            exc,
        )
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
