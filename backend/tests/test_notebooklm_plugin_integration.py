"""Phase 32B + 32C integration: NotebookLM plugin under
app.main.app.

Pins:
1. Plugin mounts under ``/api/plugins/notebooklm/*``.
2. Manual CRUD on study questions (create / patch / delete).
3. List filters by project / difficulty / topic.
4. AI generation (mocked) returns persisted rows.
5. Study guide route returns ``text/markdown`` body.
6. Validation errors (bad difficulty / type / missing user / etc).
"""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app, manager
from app.models import UserSettings


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user_and_project(client: TestClient) -> tuple[str, str]:
    u = client.post("/api/users", json={"name": "NotebookLMTester"})
    user_id = u.json()["id"]
    p = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Spanish",
            "goal": "B1",
            "timeframe": "3m",
            "daily_minutes": 30,
        },
    )
    return user_id, p.json()["id"]


def _seed_provider_key(user_id: str) -> None:
    """Same shape as the pronunciation/anki tests — give the user
    a stored Anthropic key so ``_build_ai_caller`` resolves. The
    ``ai_complete`` hook is patched per test."""
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


def _run_session(client: TestClient, project_id: str) -> str:
    sess_id = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": "deductive"},
    ).json()["session"]["id"]
    client.post(
        f"/api/plugins/session/{sess_id}/rate",
        json={"understanding": 4, "stress": 2, "method_fit": 4},
    )
    client.post(f"/api/plugins/session/{sess_id}/end")
    return sess_id


# --- Plugin wiring --------------------------------------------------------


def test_plugin_is_active(client: TestClient) -> None:
    active = {p.name for p in manager.get_active_plugins()}
    assert "notebooklm" in active


def test_router_paths_mounted(client: TestClient) -> None:
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/plugins/notebooklm/questions/{user_id}" in paths
    assert "/api/plugins/notebooklm/questions" in paths
    assert "/api/plugins/notebooklm/questions/{qid}" in paths
    assert (
        "/api/plugins/notebooklm/questions/generate/session/{session_id}"
        in paths
    )
    assert (
        "/api/plugins/notebooklm/questions/generate/project/{project_id}"
        in paths
    )
    assert "/api/plugins/notebooklm/study-guide/{project_id}" in paths


# --- Manual CRUD ----------------------------------------------------------


def test_create_question_persists(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    r = client.post(
        f"/api/plugins/notebooklm/questions?user_id={user_id}",
        json={
            "project_id": project_id,
            "question": "What is X?",
            "expected_answer": "X is foo.",
            "question_type": "open",
            "difficulty": "easy",
            "topic": "basics",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["question"] == "What is X?"
    assert body["difficulty"] == "easy"
    assert body["edited"] is False


def test_create_rejects_bad_difficulty(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    r = client.post(
        f"/api/plugins/notebooklm/questions?user_id={user_id}",
        json={
            "project_id": project_id,
            "question": "Q",
            "difficulty": "impossible",
        },
    )
    assert r.status_code == 400


def test_create_rejects_bad_type(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    r = client.post(
        f"/api/plugins/notebooklm/questions?user_id={user_id}",
        json={
            "project_id": project_id,
            "question": "Q",
            "question_type": "trivia",
        },
    )
    assert r.status_code == 400


def test_patch_edits_text_and_flips_edited(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    qid = client.post(
        f"/api/plugins/notebooklm/questions?user_id={user_id}",
        json={"project_id": project_id, "question": "old"},
    ).json()["id"]
    r = client.patch(
        f"/api/plugins/notebooklm/questions/{qid}",
        json={"question": "new", "topic": "edited-topic"},
    )
    body = r.json()
    assert body["question"] == "new"
    assert body["edited"] is True
    assert body["topic"] == "edited-topic"


def test_patch_topic_only_does_not_flip_edited(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    qid = client.post(
        f"/api/plugins/notebooklm/questions?user_id={user_id}",
        json={"project_id": project_id, "question": "old"},
    ).json()["id"]
    # Topic-only patch — text didn't change so edited stays false.
    r = client.patch(
        f"/api/plugins/notebooklm/questions/{qid}",
        json={"topic": "just-tag-change"},
    )
    assert r.json()["edited"] is False


def test_delete_question(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    qid = client.post(
        f"/api/plugins/notebooklm/questions?user_id={user_id}",
        json={"project_id": project_id, "question": "Q"},
    ).json()["id"]
    r = client.delete(f"/api/plugins/notebooklm/questions/{qid}")
    assert r.status_code == 200
    # Subsequent patch is 404.
    r2 = client.patch(
        f"/api/plugins/notebooklm/questions/{qid}",
        json={"question": "x"},
    )
    assert r2.status_code == 404


# --- List + filters -------------------------------------------------------


def test_list_filters_by_difficulty_and_topic(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    # Three questions across two difficulties / topics.
    for q, diff, top in [
        ("E1", "easy", "vocab"),
        ("M1", "medium", "vocab"),
        ("H1", "hard", "grammar"),
    ]:
        client.post(
            f"/api/plugins/notebooklm/questions?user_id={user_id}",
            json={
                "project_id": project_id,
                "question": q,
                "difficulty": diff,
                "topic": top,
            },
        )
    # All three.
    body = client.get(
        f"/api/plugins/notebooklm/questions/{user_id}"
    ).json()
    assert len(body) == 3
    # Difficulty filter.
    body = client.get(
        f"/api/plugins/notebooklm/questions/{user_id}?difficulty=easy"
    ).json()
    assert [b["question"] for b in body] == ["E1"]
    # Topic filter — case-insensitive substring.
    body = client.get(
        f"/api/plugins/notebooklm/questions/{user_id}?topic=VOCAB"
    ).json()
    questions = {b["question"] for b in body}
    assert questions == {"E1", "M1"}


def test_list_unknown_user_404(client: TestClient) -> None:
    r = client.get("/api/plugins/notebooklm/questions/nope")
    assert r.status_code == 404


def test_list_bad_difficulty_400(client: TestClient) -> None:
    user_id, _ = _make_user_and_project(client)
    r = client.get(
        f"/api/plugins/notebooklm/questions/{user_id}?difficulty=oops"
    )
    assert r.status_code == 400


# --- AI generators (mocked) ----------------------------------------------


def test_generate_from_session_persists_rows(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _seed_provider_key(user_id)
    session_id = _run_session(client, project_id)
    mock = json.dumps(
        [
            {
                "question": "What is hablar?",
                "expected_answer": "To speak.",
                "type": "open",
                "difficulty": "easy",
                "topic": "verbs",
            },
            {
                "question": "Yo ___ espanol.",
                "expected_answer": "hablo",
                "type": "fill_blank",
                "difficulty": "medium",
                "topic": "verbs",
            },
        ]
    )
    with patch.object(
        manager._pm.hook, "ai_complete", return_value=mock
    ):
        r = client.post(
            f"/api/plugins/notebooklm/questions/generate/session/{session_id}"
        )
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 2
    # The session_id FK should be set on both.
    for row in body:
        assert row["session_id"] == session_id


def test_generate_from_session_unknown_404(client: TestClient) -> None:
    r = client.post(
        "/api/plugins/notebooklm/questions/generate/session/nope"
    )
    assert r.status_code == 404


def test_generate_from_session_400_when_no_provider(
    client: TestClient,
) -> None:
    user_id, project_id = _make_user_and_project(client)
    session_id = _run_session(client, project_id)
    r = client.post(
        f"/api/plugins/notebooklm/questions/generate/session/{session_id}"
    )
    # User has no AI provider/key → validation 400.
    assert r.status_code == 400


def test_generate_from_session_returns_empty_on_bad_ai_output(
    client: TestClient,
) -> None:
    """AI hiccup (returns prose instead of JSON) is NOT a 5xx —
    the parser returns [] and the route surfaces that as an
    empty list. The user can retry."""
    user_id, project_id = _make_user_and_project(client)
    _seed_provider_key(user_id)
    session_id = _run_session(client, project_id)
    with patch.object(
        manager._pm.hook,
        "ai_complete",
        return_value="Sorry, I can't help with that.",
    ):
        r = client.post(
            f"/api/plugins/notebooklm/questions/generate/session/{session_id}"
        )
    assert r.status_code == 200
    assert r.json() == []


def test_generate_from_project_persists_with_null_session(
    client: TestClient,
) -> None:
    user_id, project_id = _make_user_and_project(client)
    _seed_provider_key(user_id)
    _run_session(client, project_id)
    mock = json.dumps(
        [
            {
                "question": "Big-picture question?",
                "expected_answer": "Big-picture answer.",
                "type": "explain",
                "difficulty": "hard",
                "topic": "overview",
            }
        ]
    )
    with patch.object(
        manager._pm.hook, "ai_complete", return_value=mock
    ):
        r = client.post(
            f"/api/plugins/notebooklm/questions/generate/project/{project_id}"
        )
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["session_id"] is None


# --- Study guide ----------------------------------------------------------


def test_study_guide_returns_markdown(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _seed_provider_key(user_id)
    _run_session(client, project_id)
    mock = "# Spanish Study Guide\n\n## Overview\n\nA project to learn Spanish."
    with patch.object(
        manager._pm.hook, "ai_complete", return_value=mock
    ):
        r = client.post(
            f"/api/plugins/notebooklm/study-guide/{project_id}"
        )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/markdown")
    assert "Spanish Study Guide" in r.text


def test_study_guide_strips_outer_fence(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _seed_provider_key(user_id)
    _run_session(client, project_id)
    fenced = "```markdown\n# Title\n\nBody.\n```"
    with patch.object(
        manager._pm.hook, "ai_complete", return_value=fenced
    ):
        r = client.post(
            f"/api/plugins/notebooklm/study-guide/{project_id}"
        )
    assert r.status_code == 200
    # Outer fence stripped; inner content preserved.
    assert r.text.startswith("# Title")
    assert "```" not in r.text


def test_study_guide_400_when_ai_returns_empty(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _seed_provider_key(user_id)
    with patch.object(
        manager._pm.hook, "ai_complete", return_value=""
    ):
        r = client.post(
            f"/api/plugins/notebooklm/study-guide/{project_id}"
        )
    assert r.status_code == 400


def test_study_guide_404_unknown_project(client: TestClient) -> None:
    r = client.post(
        "/api/plugins/notebooklm/study-guide/nope"
    )
    assert r.status_code == 404
