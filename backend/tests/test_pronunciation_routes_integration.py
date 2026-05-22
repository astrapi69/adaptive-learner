"""Phase 31C integration tests for the pronunciation routes
(session plugin)."""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app, manager
from app.models import ProjectSubject, Subject, UserSettings


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user_and_project(client: TestClient) -> tuple[str, str]:
    u = client.post("/api/users", json={"name": "PronunciationTester"})
    user_id = u.json()["id"]
    p = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Spanish",
            "goal": "Reach B1",
            "timeframe": "3m",
            "daily_minutes": 30,
        },
    )
    return user_id, p.json()["id"]


def _seed_provider_key(user_id: str) -> None:
    """Settings the user up with a stored Anthropic key so the
    AI-caller resolves successfully. We don't actually hit the
    network — the ``ai_complete`` hook is patched per test."""
    db = SessionLocal()
    try:
        from app.schemas import AIProvider, ApiKeySetBody
        from app.services import settings as settings_service

        settings_service.get_or_create_settings(db, user_id)
        settings_service.set_api_key(
            db,
            user_id,
            ApiKeySetBody(
                provider=AIProvider.ANTHROPIC, key="test-key-1234567890"
            ),
        )
        # Set as active provider.
        row = (
            db.query(UserSettings)
            .filter(UserSettings.user_id == user_id)
            .first()
        )
        assert row is not None
        row.active_provider = "anthropic"
        db.commit()
    finally:
        db.close()


def _assign_language_subject(project_id: str) -> None:
    """Force the project to be language-eligible by attaching
    a subject under the seeded ``Languages`` root."""
    db = SessionLocal()
    try:
        langs = (
            db.query(Subject).filter(Subject.name == "Languages").first()
        )
        assert langs is not None, "Languages subject not seeded"
        # Find a leaf under it (or use the root itself).
        db.add(ProjectSubject(project_id=project_id, subject_id=langs.id))
        db.commit()
    finally:
        db.close()


# --- Route wiring --------------------------------------------------------


def test_router_paths_mounted(client: TestClient) -> None:
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/plugins/session/pronunciation/phrase" in paths
    assert "/api/plugins/session/pronunciation/judge" in paths
    assert (
        "/api/plugins/session/pronunciation/eligibility/{project_id}"
        in paths
    )


# --- Eligibility -----------------------------------------------------------


def test_eligibility_false_without_subjects(client: TestClient) -> None:
    _, project_id = _make_user_and_project(client)
    r = client.get(
        f"/api/plugins/session/pronunciation/eligibility/{project_id}"
    )
    assert r.status_code == 200
    assert r.json() == {"eligible": False}


def test_eligibility_true_with_language_subject(
    client: TestClient,
) -> None:
    _, project_id = _make_user_and_project(client)
    _assign_language_subject(project_id)
    r = client.get(
        f"/api/plugins/session/pronunciation/eligibility/{project_id}"
    )
    assert r.status_code == 200
    assert r.json() == {"eligible": True}


def test_eligibility_unknown_project_returns_404(
    client: TestClient,
) -> None:
    r = client.get(
        "/api/plugins/session/pronunciation/eligibility/nope"
    )
    assert r.status_code == 404


# --- Phrase generator + judge (mocked AI) --------------------------------


def test_phrase_generates_via_mocked_ai(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _seed_provider_key(user_id)
    mock_response = json.dumps({"phrase": "Yo hablo español"})
    with patch.object(
        manager._pm.hook, "ai_complete", return_value=mock_response
    ):
        r = client.post(
            "/api/plugins/session/pronunciation/phrase",
            json={"project_id": project_id, "language": "Spanish"},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["phrase"] == "Yo hablo español"
    assert body["language"] == "Spanish"


def test_phrase_400_when_ai_parse_fails(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _seed_provider_key(user_id)
    with patch.object(
        manager._pm.hook, "ai_complete", return_value="not json at all"
    ):
        r = client.post(
            "/api/plugins/session/pronunciation/phrase",
            json={"project_id": project_id, "language": "es"},
        )
    assert r.status_code == 400


def test_phrase_404_unknown_project(client: TestClient) -> None:
    r = client.post(
        "/api/plugins/session/pronunciation/phrase",
        json={"project_id": "nope", "language": "es"},
    )
    assert r.status_code == 404


def test_phrase_400_when_user_has_no_provider_key(
    client: TestClient,
) -> None:
    _, project_id = _make_user_and_project(client)
    r = client.post(
        "/api/plugins/session/pronunciation/phrase",
        json={"project_id": project_id, "language": "es"},
    )
    assert r.status_code == 400


def test_judge_returns_verdict(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _seed_provider_key(user_id)
    mock_response = json.dumps(
        {
            "matches": False,
            "score": 0.6,
            "feedback": "Watch the 'h' sound.",
            "missed_sounds": ["h"],
        }
    )
    with patch.object(
        manager._pm.hook, "ai_complete", return_value=mock_response
    ):
        r = client.post(
            "/api/plugins/session/pronunciation/judge",
            json={
                "project_id": project_id,
                "target": "Yo hablo español",
                "actual": "Yo ablo espanol",
                "language": "Spanish",
            },
        )
    assert r.status_code == 200
    body = r.json()
    assert body["matches"] is False
    assert body["score"] == 0.6
    assert body["feedback"].startswith("Watch")
    assert body["missed_sounds"] == ["h"]


def test_judge_rejects_empty_target_or_actual(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _seed_provider_key(user_id)
    r = client.post(
        "/api/plugins/session/pronunciation/judge",
        json={
            "project_id": project_id,
            "target": "",
            "actual": "anything",
        },
    )
    assert r.status_code == 400
