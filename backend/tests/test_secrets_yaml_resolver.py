"""Phase 34 (v1.20.0) — ``secrets.yaml`` resolver + template tests.

Covers:
  - ``resolve_api_key`` precedence: env > secrets.yaml > DB > none
  - ``resolve_default_model`` precedence: env > secrets.yaml >
    UserSettings.model_override > None
  - ``detect_api_key_source`` source attribution including the
    env-equals-yaml heuristic
  - ``ensure_template_exists`` creates the template with 0600
    perms on first run, no-op on subsequent runs
  - ``audit_permissions`` warns when file is world-readable
  - ``_load_override_file`` survives malformed YAML + non-dict
    top-level (loader contract, already audited by Bibliogon
    parity but pinned here against future regressions)
"""

from __future__ import annotations

import os
import sys
from collections.abc import Iterator
from pathlib import Path

import pytest
import yaml

from app.database import SessionLocal
from app.main import _load_override_file
from app.models import User, UserSettings
from app.schemas import AIProvider, ApiKeySource
from app.services import crypto
from app.services import settings as settings_service
from app.services.secrets_template import (
    audit_permissions,
    ensure_template_exists,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def db() -> Iterator:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def fake_secrets_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[Path]:
    """Redirect ``_get_user_override_path`` to a tmp file so the
    resolver reads from the test-controlled yaml.
    """
    path = tmp_path / "secrets.yaml"
    monkeypatch.setattr(
        "app.main._get_user_override_path",
        lambda: path,
    )
    yield path


@pytest.fixture()
def user_with_db_key(db) -> User:
    """A user with a DB-encrypted Anthropic key."""
    user = User(name="TestUser", language="en")
    db.add(user)
    db.commit()
    settings = UserSettings(
        user_id=user.id,
        api_key_anthropic=crypto.encrypt_api_key("db-key-anthropic"),
    )
    db.add(settings)
    db.commit()
    return user


def _write_yaml(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(data), encoding="utf-8")


# ---------------------------------------------------------------------------
# resolve_api_key precedence
# ---------------------------------------------------------------------------


def test_resolve_api_key_env_wins(
    db,
    user_with_db_key: User,
    fake_secrets_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """ADAPTIVE_LEARNER_ANTHROPIC_API_KEY beats secrets.yaml and
    the DB column."""
    _write_yaml(fake_secrets_path, {"ai": {"anthropic": {"api_key": "yaml-key"}}})
    monkeypatch.setenv("ADAPTIVE_LEARNER_ANTHROPIC_API_KEY", "env-key")
    key, source = settings_service.resolve_api_key(
        db, user_with_db_key.id, AIProvider.ANTHROPIC
    )
    assert key == "env-key"
    assert source is ApiKeySource.ENV


def test_resolve_api_key_secrets_yaml_wins_over_db(
    db,
    user_with_db_key: User,
    fake_secrets_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """secrets.yaml beats the DB-encrypted column when env is empty."""
    monkeypatch.delenv("ADAPTIVE_LEARNER_ANTHROPIC_API_KEY", raising=False)
    _write_yaml(fake_secrets_path, {"ai": {"anthropic": {"api_key": "yaml-key"}}})
    key, source = settings_service.resolve_api_key(
        db, user_with_db_key.id, AIProvider.ANTHROPIC
    )
    assert key == "yaml-key"
    assert source is ApiKeySource.SECRETS_YAML


def test_resolve_api_key_db_when_no_env_no_yaml(
    db,
    user_with_db_key: User,
    fake_secrets_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No env + no yaml + DB column set -> SETTINGS."""
    monkeypatch.delenv("ADAPTIVE_LEARNER_ANTHROPIC_API_KEY", raising=False)
    # fake_secrets_path file does not exist; loader returns {}.
    assert not fake_secrets_path.exists()
    key, source = settings_service.resolve_api_key(
        db, user_with_db_key.id, AIProvider.ANTHROPIC
    )
    assert key == "db-key-anthropic"
    assert source is ApiKeySource.SETTINGS


def test_resolve_api_key_none_when_nothing_set(
    db, fake_secrets_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Fresh user, no env, no yaml, no DB -> (None, NONE)."""
    user = User(name="TestUser", language="en")
    db.add(user)
    db.commit()
    monkeypatch.delenv("ADAPTIVE_LEARNER_ANTHROPIC_API_KEY", raising=False)
    assert not fake_secrets_path.exists()
    key, source = settings_service.resolve_api_key(
        db, user.id, AIProvider.ANTHROPIC
    )
    assert key is None
    assert source is ApiKeySource.NONE


def test_env_equals_yaml_attributed_to_yaml(
    db,
    user_with_db_key: User,
    fake_secrets_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When env was hydrated from yaml (same value), source is
    SECRETS_YAML. This is the common desktop-launcher case where
    ``_hydrate_env_from_config`` populated the env at startup."""
    _write_yaml(fake_secrets_path, {"ai": {"anthropic": {"api_key": "same-key"}}})
    monkeypatch.setenv("ADAPTIVE_LEARNER_ANTHROPIC_API_KEY", "same-key")
    key, source = settings_service.resolve_api_key(
        db, user_with_db_key.id, AIProvider.ANTHROPIC
    )
    assert key == "same-key"
    assert source is ApiKeySource.SECRETS_YAML


def test_env_differs_from_yaml_attributed_to_env(
    db,
    user_with_db_key: User,
    fake_secrets_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """env set directly (different value) -> ENV wins, source ENV."""
    _write_yaml(fake_secrets_path, {"ai": {"anthropic": {"api_key": "yaml-key"}}})
    monkeypatch.setenv("ADAPTIVE_LEARNER_ANTHROPIC_API_KEY", "shell-key")
    key, source = settings_service.resolve_api_key(
        db, user_with_db_key.id, AIProvider.ANTHROPIC
    )
    assert key == "shell-key"
    assert source is ApiKeySource.ENV


def test_other_providers_unaffected_by_anthropic_yaml(
    db,
    user_with_db_key: User,
    fake_secrets_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """secrets.yaml is per-provider; setting Anthropic must not
    bleed into OpenAI or Gemini."""
    monkeypatch.delenv("ADAPTIVE_LEARNER_OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ADAPTIVE_LEARNER_GEMINI_API_KEY", raising=False)
    _write_yaml(fake_secrets_path, {"ai": {"anthropic": {"api_key": "yaml-key"}}})
    for provider in (AIProvider.OPENAI, AIProvider.GEMINI):
        key, source = settings_service.resolve_api_key(
            db, user_with_db_key.id, provider
        )
        assert key is None
        assert source is ApiKeySource.NONE


def test_resolve_api_key_blank_yaml_value_falls_through(
    db,
    user_with_db_key: User,
    fake_secrets_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Empty / whitespace string in secrets.yaml is treated as
    "not set" so we fall through to the DB."""
    _write_yaml(fake_secrets_path, {"ai": {"anthropic": {"api_key": "   "}}})
    monkeypatch.delenv("ADAPTIVE_LEARNER_ANTHROPIC_API_KEY", raising=False)
    key, source = settings_service.resolve_api_key(
        db, user_with_db_key.id, AIProvider.ANTHROPIC
    )
    assert key == "db-key-anthropic"
    assert source is ApiKeySource.SETTINGS


# ---------------------------------------------------------------------------
# resolve_default_model precedence
# ---------------------------------------------------------------------------


def test_resolve_default_model_env_wins(
    db,
    user_with_db_key: User,
    fake_secrets_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _write_yaml(fake_secrets_path, {"ai": {"anthropic": {"default_model": "yaml-model"}}})
    monkeypatch.setenv("ADAPTIVE_LEARNER_ANTHROPIC_DEFAULT_MODEL", "env-model")
    assert (
        settings_service.resolve_default_model(
            db, user_with_db_key.id, AIProvider.ANTHROPIC
        )
        == "env-model"
    )


def test_resolve_default_model_yaml_beats_ui_override(
    db,
    user_with_db_key: User,
    fake_secrets_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Per the v1.20.0 decision (Q2): secrets.yaml beats the UI
    override. Power users who configure files expect file-level
    config to win over the UI."""
    settings = settings_service.get_or_create_settings(db, user_with_db_key.id)
    settings.model_override_anthropic = "ui-model"
    db.commit()
    _write_yaml(
        fake_secrets_path, {"ai": {"anthropic": {"default_model": "yaml-model"}}}
    )
    monkeypatch.delenv("ADAPTIVE_LEARNER_ANTHROPIC_DEFAULT_MODEL", raising=False)
    assert (
        settings_service.resolve_default_model(
            db, user_with_db_key.id, AIProvider.ANTHROPIC
        )
        == "yaml-model"
    )


def test_resolve_default_model_ui_override_when_no_env_no_yaml(
    db,
    user_with_db_key: User,
    fake_secrets_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = settings_service.get_or_create_settings(db, user_with_db_key.id)
    settings.model_override_anthropic = "ui-model"
    db.commit()
    monkeypatch.delenv("ADAPTIVE_LEARNER_ANTHROPIC_DEFAULT_MODEL", raising=False)
    assert not fake_secrets_path.exists()
    assert (
        settings_service.resolve_default_model(
            db, user_with_db_key.id, AIProvider.ANTHROPIC
        )
        == "ui-model"
    )


def test_resolve_default_model_none_when_nothing_set(
    db,
    user_with_db_key: User,
    fake_secrets_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("ADAPTIVE_LEARNER_ANTHROPIC_DEFAULT_MODEL", raising=False)
    assert not fake_secrets_path.exists()
    assert (
        settings_service.resolve_default_model(
            db, user_with_db_key.id, AIProvider.ANTHROPIC
        )
        is None
    )


# ---------------------------------------------------------------------------
# detect_api_key_source mirrors resolve_api_key
# ---------------------------------------------------------------------------


def test_detect_api_key_source_matches_resolver(
    db,
    user_with_db_key: User,
    fake_secrets_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The router uses detect_api_key_source to populate the
    UserSettingsOut response; it must agree with what
    resolve_api_key returns at the same instant."""
    monkeypatch.delenv("ADAPTIVE_LEARNER_ANTHROPIC_API_KEY", raising=False)
    _write_yaml(fake_secrets_path, {"ai": {"anthropic": {"api_key": "yaml-key"}}})
    _, source = settings_service.resolve_api_key(
        db, user_with_db_key.id, AIProvider.ANTHROPIC
    )
    assert (
        settings_service.detect_api_key_source(
            db, user_with_db_key.id, AIProvider.ANTHROPIC
        )
        == source
    )


# ---------------------------------------------------------------------------
# Override-file loader (malformed / non-dict / missing)
# ---------------------------------------------------------------------------


def test_loader_missing_file_returns_empty(tmp_path: Path) -> None:
    assert _load_override_file(tmp_path / "does-not-exist.yaml") == {}


def test_loader_malformed_yaml_returns_empty(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    p = tmp_path / "secrets.yaml"
    p.write_text("not: : valid: yaml:\n  - [", encoding="utf-8")
    with caplog.at_level("WARNING", logger="app.main"):
        assert _load_override_file(p) == {}
    assert any("Could not read override file" in r.message for r in caplog.records)


def test_loader_non_dict_top_level_returns_empty(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    p = tmp_path / "secrets.yaml"
    p.write_text("- just\n- a\n- list\n", encoding="utf-8")
    with caplog.at_level("WARNING", logger="app.main"):
        assert _load_override_file(p) == {}
    assert any("top-level is" in r.message for r in caplog.records)


# ---------------------------------------------------------------------------
# Template generation + permission audit
# ---------------------------------------------------------------------------


def test_template_created_on_first_run_with_0600(tmp_path: Path) -> None:
    path = tmp_path / "secrets.yaml"
    assert ensure_template_exists(path) is True
    assert path.exists()
    body = path.read_text(encoding="utf-8")
    # Template body sanity checks — no real keys, all helpful
    # comments present.
    assert "secret_key:" in body
    assert "api_key:" in body  # commented examples
    assert body.count("#") > 10  # the template is heavily commented
    if sys.platform != "win32":
        mode = path.stat().st_mode & 0o777
        assert mode == 0o600, f"expected 0600, got {oct(mode)}"


def test_template_no_op_when_file_exists(tmp_path: Path) -> None:
    path = tmp_path / "secrets.yaml"
    path.write_text("existing: content\n", encoding="utf-8")
    # No overwrite.
    assert ensure_template_exists(path) is False
    assert path.read_text(encoding="utf-8") == "existing: content\n"


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX-only chmod semantics")
def test_audit_warns_on_world_readable(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    path = tmp_path / "secrets.yaml"
    path.write_text("anything: at all\n", encoding="utf-8")
    os.chmod(path, 0o644)
    with caplog.at_level("WARNING", logger="app.services.secrets_template"):
        audit_permissions(path)
    assert any("group/world readable" in r.message for r in caplog.records)


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX-only chmod semantics")
def test_audit_quiet_on_0600(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    path = tmp_path / "secrets.yaml"
    path.write_text("anything: at all\n", encoding="utf-8")
    os.chmod(path, 0o600)
    with caplog.at_level("WARNING", logger="app.services.secrets_template"):
        audit_permissions(path)
    assert not any("group/world readable" in r.message for r in caplog.records)


def test_audit_silent_on_missing_file(tmp_path: Path) -> None:
    # No-op, no log, no exception.
    audit_permissions(tmp_path / "nope.yaml")
