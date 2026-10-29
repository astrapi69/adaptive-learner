"""AI content-validation service + route (Phase 60 / v1.44.0, C5b)."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.exceptions import ExternalServiceError
from app.main import app, manager
from app.models import UserSettings
from app.repositories.settings_repo import SqlAlchemySettingsRepository
from app.schemas import AIProvider, ApiKeySetBody
from app.services import content_validation
from app.services import settings as settings_service

client = TestClient(app)


def test_build_messages_has_system_and_user() -> None:
    messages = content_validation.build_validation_messages(
        target_language="fr",
        source_language="de",
        level="A1",
        lessons=[{"id": "01", "cards": [], "steps": []}],
    )
    assert [m["role"] for m in messages] == ["system", "user"]
    assert "JSON" in messages[0]["content"]
    assert "fr" in messages[0]["content"] and "de" in messages[0]["content"]
    assert "01" in messages[1]["content"]


def test_parse_result_normalises_a_clean_response() -> None:
    raw = """Here you go:
    ```json
    {"overall": "pass", "translation_issues": [], "distractor_issues": [],
     "grammar_issues": [], "level_issues": [], "cultural_flags": [],
     "quality_score": 0.92}
    ```"""
    parsed = content_validation.parse_validation_result(raw)
    assert parsed is not None
    assert parsed["overall"] == "pass"
    assert parsed["quality_score"] == 0.92


def test_parse_result_infers_review_needed_from_issues() -> None:
    raw = (
        '{"translation_issues": [{"card_id": "c1", "issue": "wrong", '
        '"suggestion": "fix"}], "quality_score": 0.4}'
    )
    parsed = content_validation.parse_validation_result(raw)
    assert parsed is not None
    assert parsed["overall"] == "review_needed"
    assert parsed["translation_issues"][0]["card_id"] == "c1"


def test_parse_result_clamps_score_and_drops_junk() -> None:
    parsed = content_validation.parse_validation_result(
        '{"quality_score": 5, "translation_issues": ["not-an-object", {"card_id": ""}]}'
    )
    assert parsed is not None
    assert parsed["quality_score"] == 1.0
    # The empty/garbage issues are dropped.
    assert parsed["translation_issues"] == []


def test_parse_result_returns_none_on_garbage() -> None:
    assert content_validation.parse_validation_result("not json at all") is None


def test_validate_lesson_route_400_without_api_key() -> None:
    # Create a user (default settings: an active provider but no key).
    resp = client.post("/api/users", json={"name": "Val", "language": "de"})
    assert resp.status_code in (200, 201), resp.text
    user_id = resp.json()["id"]
    resp = client.post(
        "/api/content/validate-lesson",
        json={
            "user_id": user_id,
            "title": "Französisch A1",
            "title_native": "Français A1",
            "target_language": "fr",
            "source_language": "de",
            "level": "A1",
            "lessons": [{"id": "01", "cards": [], "steps": []}],
        },
    )
    # No resolvable API key -> ValidationError -> 400 (or 422 if the
    # active provider is unset). Either way, not a 5xx / 200.
    assert resp.status_code in (400, 422), resp.text


# --- #3420: the route resolves through ai_caller, the service reviews ------

_REVIEW_KW = {
    "target_language": "fr",
    "source_language": "de",
    "level": "A1",
    "lessons": [{"id": "01", "cards": [], "steps": []}],
}


@pytest.mark.parametrize(
    "reply",
    [None, "", "   ", "not json at all"],
    ids=["none", "empty", "blank", "garbage"],
)
def test_review_lesson_raises_external_error_on_an_unusable_reply(reply: str | None) -> None:
    with pytest.raises(ExternalServiceError) as caught:
        content_validation.review_lesson(lambda _m: reply, "anthropic", **_REVIEW_KW)
    assert "anthropic" in str(caught.value)


def test_validate_lesson_route_fires_the_hook_with_the_resolved_model(monkeypatch) -> None:
    """Happy path through the real resolution: the stored key and the
    default model reach ``ai_complete``, the parsed review comes back."""
    user_id = client.post("/api/users", json={"name": "ValOk", "language": "de"}).json()["id"]
    db = SessionLocal()
    try:
        repo = SqlAlchemySettingsRepository(db)
        settings_service.get_or_create_settings(repo, user_id)
        settings_service.set_api_key(
            repo, user_id, ApiKeySetBody(provider=AIProvider.ANTHROPIC, key="test-key-1234567890")
        )
        row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        assert row is not None
        row.active_provider = "anthropic"
        db.commit()
    finally:
        db.close()

    seen: dict[str, object] = {}

    def fake_hook(**kwargs: object) -> str:
        seen.update(kwargs)
        return json.dumps({"overall": "pass", "quality_score": 0.9})

    monkeypatch.setattr(manager._pm.hook, "ai_complete", fake_hook)
    resp = client.post(
        "/api/content/validate-lesson",
        json={"user_id": user_id, "title": "Französisch A1", **_REVIEW_KW},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["overall"] == "pass"
    assert seen["model"] == "claude-haiku-4-5-20251001"
    assert seen["api_key"] == "test-key-1234567890"
    assert seen["max_tokens"] == 1500
