"""AI content-validation service + route (Phase 60 / v1.44.0, C5b)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services import content_validation

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
