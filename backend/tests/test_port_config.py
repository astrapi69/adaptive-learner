"""Phase 1C-A.5 tests for the port + CORS resolvers in app.main."""

from __future__ import annotations

import pytest

from app.main import (
    DEFAULT_BACKEND_PORT,
    DEFAULT_FRONTEND_PORT,
    _load_app_config,
    resolve_backend_port,
    resolve_cors_origins,
)

# --- defaults ---------------------------------------------------------------


def test_default_backend_port_is_non_standard():
    """Locked at 18001 so Adaptive Learner coexists with anything
    already bound to :8000 on the workstation."""
    assert DEFAULT_BACKEND_PORT == 18001


def test_default_frontend_port_is_non_standard():
    """Locked at 15174 so vite coexists with anything on :5173."""
    assert DEFAULT_FRONTEND_PORT == 15174


# --- resolve_backend_port ---------------------------------------------------


def test_resolve_backend_port_env_wins(monkeypatch):
    monkeypatch.setenv("ADAPTIVE_LEARNER_PORT", "22222")
    assert resolve_backend_port({}) == 22222


def test_resolve_backend_port_config_when_no_env(monkeypatch):
    monkeypatch.delenv("ADAPTIVE_LEARNER_PORT", raising=False)
    assert resolve_backend_port({"server": {"port": 19001}}) == 19001


def test_resolve_backend_port_default_when_nothing(monkeypatch):
    monkeypatch.delenv("ADAPTIVE_LEARNER_PORT", raising=False)
    assert resolve_backend_port({}) == DEFAULT_BACKEND_PORT


def test_resolve_backend_port_ignores_malformed_env(monkeypatch):
    monkeypatch.setenv("ADAPTIVE_LEARNER_PORT", "not-a-number")
    assert resolve_backend_port({"server": {"port": 19001}}) == 19001


@pytest.mark.parametrize("bad_port", [0, -1, 70000, "0", "70000"])
def test_resolve_backend_port_rejects_out_of_range(monkeypatch, bad_port):
    monkeypatch.setenv("ADAPTIVE_LEARNER_PORT", str(bad_port))
    # Out-of-range env value is dropped; falls through to config / default.
    assert resolve_backend_port({}) == DEFAULT_BACKEND_PORT


# --- resolve_cors_origins ---------------------------------------------------


def test_resolve_cors_env_wins(monkeypatch):
    monkeypatch.setenv(
        "ADAPTIVE_LEARNER_CORS_ORIGINS",
        "http://localhost:15174,http://localhost:3000",
    )
    assert resolve_cors_origins({}) == [
        "http://localhost:15174",
        "http://localhost:3000",
    ]


def test_resolve_cors_env_strips_whitespace_and_empties(monkeypatch):
    monkeypatch.setenv(
        "ADAPTIVE_LEARNER_CORS_ORIGINS",
        " http://a ,, http://b ",
    )
    assert resolve_cors_origins({}) == ["http://a", "http://b"]


def test_resolve_cors_config_when_no_env(monkeypatch):
    monkeypatch.delenv("ADAPTIVE_LEARNER_CORS_ORIGINS", raising=False)
    cfg = {"server": {"cors_origins": ["http://localhost:15174", "http://localhost:9999"]}}
    assert resolve_cors_origins(cfg) == [
        "http://localhost:15174",
        "http://localhost:9999",
    ]


def test_resolve_cors_default_when_nothing(monkeypatch):
    monkeypatch.delenv("ADAPTIVE_LEARNER_CORS_ORIGINS", raising=False)
    assert resolve_cors_origins({}) == [f"http://localhost:{DEFAULT_FRONTEND_PORT}"]


def test_resolve_cors_default_uses_frontend_port_constant(monkeypatch):
    """Regression pin: changing DEFAULT_FRONTEND_PORT must update the
    fallback too. Catches a future refactor that hardcodes the URL."""
    monkeypatch.delenv("ADAPTIVE_LEARNER_CORS_ORIGINS", raising=False)
    fallback = resolve_cors_origins({})[0]
    assert str(DEFAULT_FRONTEND_PORT) in fallback


def test_resolve_cors_ignores_non_list_config(monkeypatch):
    monkeypatch.delenv("ADAPTIVE_LEARNER_CORS_ORIGINS", raising=False)
    cfg = {"server": {"cors_origins": "http://localhost:9999"}}
    # Falls through to default because the value is not a list.
    assert resolve_cors_origins(cfg) == [f"http://localhost:{DEFAULT_FRONTEND_PORT}"]


def test_app_yaml_cors_contains_default_frontend_port():
    """The committed backend/config/app.yaml must keep
    http://localhost:15174 in its cors_origins list, otherwise local
    `make dev` will produce mysterious browser-side CORS errors.
    """
    from pathlib import Path

    import yaml

    cfg_path = Path(__file__).resolve().parent.parent / "config" / "app.yaml"
    with cfg_path.open(encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    origins = (cfg.get("server") or {}).get("cors_origins") or []
    assert f"http://localhost:{DEFAULT_FRONTEND_PORT}" in origins, (
        f"backend/config/app.yaml server.cors_origins is missing "
        f"http://localhost:{DEFAULT_FRONTEND_PORT}; got {origins!r}."
    )


def test_app_yaml_server_port_matches_default():
    """Same rule for the documented backend port."""
    from pathlib import Path

    import yaml

    cfg_path = Path(__file__).resolve().parent.parent / "config" / "app.yaml"
    with cfg_path.open(encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    port = (cfg.get("server") or {}).get("port")
    assert port == DEFAULT_BACKEND_PORT, (
        f"backend/config/app.yaml server.port should be {DEFAULT_BACKEND_PORT}, got {port!r}."
    )


# --- _load_app_config defensive paths (issue #197) --------------------------


def test_load_app_config_malformed_logs_and_degrades(tmp_path, monkeypatch, caplog):
    """Regression pin (#197): a corrupt app.yaml must NOT be swallowed
    silently. _load_app_config logs a warning and degrades to the
    overlay/env layers instead of booting with all-defaults invisibly.
    """
    bad = tmp_path / "app.yaml"
    bad.write_text("server:\n  port: [unbalanced\n", encoding="utf-8")
    monkeypatch.setattr("app.main.CONFIG_PATH", bad)

    with caplog.at_level("WARNING", logger="app.main"):
        config = _load_app_config()

    assert isinstance(config, dict)
    assert any(
        "app.yaml" in record.getMessage() or str(bad) in record.getMessage()
        for record in caplog.records
    ), "a corrupt app.yaml must emit a WARNING, not be swallowed silently"


def test_load_app_config_missing_file_logs_and_degrades(tmp_path, monkeypatch, caplog):
    """The narrowed except must still catch the OSError from a missing
    config file (the realistic deployment case) and degrade with a log.
    """
    missing = tmp_path / "does-not-exist" / "app.yaml"
    monkeypatch.setattr("app.main.CONFIG_PATH", missing)

    with caplog.at_level("WARNING", logger="app.main"):
        config = _load_app_config()

    assert isinstance(config, dict)
    assert caplog.records, "a missing app.yaml must emit a WARNING, not be swallowed"
