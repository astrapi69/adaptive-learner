"""Unit tests for the shared ``app.services.ai_caller.build_ai_caller``.

Consolidates the three former per-plugin ``_build_ai_caller`` copies
(anki / notebooklm / session pronunciation). Pins the resolution
branches: happy path with the provider default model, the
per-provider override, the non-string hook result, and the two
reachable ``ValidationError`` paths (no valid provider, no stored key).
"""

from __future__ import annotations

import re
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.exceptions import ValidationError
from app.main import app, manager
from app.models import UserSettings
from app.repositories.settings_repo import SqlAlchemySettingsRepository
from app.schemas import AIProvider, ApiKeySetBody
from app.services import settings as settings_service
from app.services.ai_caller import DEFAULT_MODELS, build_ai_caller, resolve_ai_target


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user(client: TestClient) -> str:
    resp = client.post("/api/users", json={"name": "AiCallerTester"})
    return resp.json()["id"]


def _seed_anthropic_key(user_id: str, *, model_override: str | None = None) -> None:
    """Give the user a stored Anthropic key + active provider so the
    caller resolves. The network is never hit — the ``ai_complete``
    hook is patched in each test."""
    db = SessionLocal()
    try:
        repo = SqlAlchemySettingsRepository(db)
        settings_service.get_or_create_settings(repo, user_id)
        settings_service.set_api_key(
            repo,
            user_id,
            ApiKeySetBody(provider=AIProvider.ANTHROPIC, key="test-key-1234567890"),
        )
        row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        assert row is not None
        row.active_provider = "anthropic"
        if model_override is not None:
            row.model_override_anthropic = model_override
        db.commit()
    finally:
        db.close()


def _build(user_id: str, **kwargs):
    db = SessionLocal()
    try:
        return build_ai_caller(db, user_id, **kwargs)
    finally:
        db.close()


def test_fires_hook_with_default_model(client: TestClient) -> None:
    user_id = _make_user(client)
    _seed_anthropic_key(user_id)
    caller = _build(user_id, max_tokens=321)
    with patch.object(manager._pm.hook, "ai_complete", return_value="hi") as mock_hook:
        out = caller([{"role": "user", "content": "x"}])
    assert out == "hi"
    _, kwargs = mock_hook.call_args
    assert kwargs["model"] == DEFAULT_MODELS["anthropic"]
    assert kwargs["max_tokens"] == 321
    assert kwargs["api_key"] == "test-key-1234567890"


def test_prefers_model_override(client: TestClient) -> None:
    user_id = _make_user(client)
    _seed_anthropic_key(user_id, model_override="claude-custom-xyz")
    caller = _build(user_id)
    with patch.object(manager._pm.hook, "ai_complete", return_value="ok") as mock_hook:
        caller([{"role": "user", "content": "x"}])
    _, kwargs = mock_hook.call_args
    assert kwargs["model"] == "claude-custom-xyz"


def test_default_max_tokens_is_512(client: TestClient) -> None:
    user_id = _make_user(client)
    _seed_anthropic_key(user_id)
    caller = _build(user_id)
    with patch.object(manager._pm.hook, "ai_complete", return_value="ok") as mock_hook:
        caller([{"role": "user", "content": "x"}])
    _, kwargs = mock_hook.call_args
    assert kwargs["max_tokens"] == 512


def test_non_string_hook_result_becomes_none(client: TestClient) -> None:
    user_id = _make_user(client)
    _seed_anthropic_key(user_id)
    caller = _build(user_id)
    with patch.object(manager._pm.hook, "ai_complete", return_value=None):
        assert caller([{"role": "user", "content": "x"}]) is None


def test_invalid_active_provider_raises(client: TestClient) -> None:
    user_id = _make_user(client)
    db = SessionLocal()
    try:
        settings_service.get_or_create_settings(SqlAlchemySettingsRepository(db), user_id)
        row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        assert row is not None
        row.active_provider = "not-a-provider"
        db.commit()
    finally:
        db.close()
    with pytest.raises(ValidationError, match="no valid active AI provider"):
        _build(user_id)


def test_missing_api_key_raises(client: TestClient) -> None:
    user_id = _make_user(client)
    # Fresh settings: active_provider defaults to "anthropic" but no
    # key is stored (and the test harness isolates env / secrets.yaml).
    db = SessionLocal()
    try:
        settings_service.get_or_create_settings(SqlAlchemySettingsRepository(db), user_id)
    finally:
        db.close()
    with pytest.raises(ValidationError, match="no stored API key"):
        _build(user_id)


# --- #3420: one provider-default table -------------------------------------


_DEFAULT_TABLE_LITERAL = re.compile(r"""["']anthropic["']\s*:\s*["']claude-""")


def _production_python_files() -> list[Path]:
    root = Path(__file__).resolve().parents[2]
    files = list((root / "backend" / "app").rglob("*.py"))
    for package in (root / "plugins").glob("adaptive-learner-plugin-*/adaptive_learner_*"):
        files.extend(package.rglob("*.py"))
    return files


def test_default_models_has_no_second_copy() -> None:
    """#3420: the imports and content routers and the session plugin each
    carried their own provider-default table, so a model bump could miss
    one. ``app.services.ai_caller.DEFAULT_MODELS`` is the only table."""
    files = _production_python_files()
    # #2083 point 4: report the set size, never pass on an empty scan.
    assert len(files) > 150, f"only {len(files)} production files scanned"
    copies = [
        str(path)
        for path in files
        if path.name != "ai_caller.py"
        and _DEFAULT_TABLE_LITERAL.search(path.read_text(encoding="utf-8"))
    ]
    assert copies == []


def test_session_plugin_reads_the_core_table() -> None:
    from adaptive_learner_session import session_runner, streaming

    assert session_runner.DEFAULT_MODELS is DEFAULT_MODELS
    assert streaming.DEFAULT_MODELS is DEFAULT_MODELS


@pytest.mark.parametrize("provider", list(AIProvider), ids=lambda p: p.value)
def test_default_models_covers_every_provider(provider: AIProvider) -> None:
    """Moved from the session plugin's tests with the table (#3420)."""
    assert DEFAULT_MODELS.get(provider.value)


def test_resolve_ai_target_returns_provider_model_and_key(client: TestClient) -> None:
    user_id = _make_user(client)
    _seed_anthropic_key(user_id)
    db = SessionLocal()
    try:
        target = resolve_ai_target(SqlAlchemySettingsRepository(db), user_id)
    finally:
        db.close()
    assert target.provider_key == "anthropic"
    assert target.model == DEFAULT_MODELS["anthropic"]
    assert target.api_key == "test-key-1234567890"
