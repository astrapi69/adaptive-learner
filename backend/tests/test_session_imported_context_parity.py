"""Backend parity for imported-chat sessions (#1154).

Mirrors the Dexie-mode fixes (#1122 rebuild-on-resume, #1137 #797-suppression,
#1147 session.get FK) on the API/desktop path:

- **1a (#1137):** an imported session's system prompt does NOT carry the
  learner lesson-progress block (#797) — that "Currently working on: <lesson>"
  line would pull the tutor onto an unrelated in-progress lesson (the
  "Inception" drift). A normal session still gets it.
- **1b (#1122):** on a later turn the imported session's system message is
  REBUILT fresh from the conversation FK, so a context change (here: a mutated
  analysis) reaches the AI call instead of the frozen persisted copy.
- **1c (#1147):** ``GET /session/{id}`` returns ``imported_conversation_id``.
"""

from __future__ import annotations

import json

import pluggy
import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app, manager
from app.models import (
    ElementError,
    ImportedConversation,
    LessonProgress,
)

hookimpl = pluggy.HookimplMarker("adaptive_learner.plugins")


@pytest.fixture(name="client")
def _client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def capturing_ai():
    """Register a stub ``ai_complete`` that records every messages payload it
    sees, so a test can inspect what reached the AI on a given turn. Returns a
    non-JSON reply so the step evaluator takes its deterministic fallback."""

    class _CapturingAi:
        name = "capturing-ai"
        api_version = "1"

        def __init__(self) -> None:
            self.calls: list[list[dict[str, str]]] = []
            self.reply: str = "OK."

        @hookimpl(tryfirst=True)
        def ai_complete(self, messages, model, api_key):
            del model, api_key
            self.calls.append([dict(m) for m in messages])
            return self.reply

    plugin = _CapturingAi()
    manager._pm.register(plugin)
    try:
        yield plugin
    finally:
        manager._pm.unregister(plugin)


def _make_user_and_project(client: TestClient) -> tuple[str, str]:
    user_id = client.post("/api/users", json={"name": "Importer"}).json()["id"]
    project_id = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Spanish",
            "goal": "Continue from my chat.",
            "timeframe": "2 weeks",
            "daily_minutes": 20,
        },
    ).json()["id"]
    return user_id, project_id


def _seed_api_key(client: TestClient, user_id: str, provider: str = "anthropic") -> None:
    resp = client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": provider, "key": "sk-fake-test-key"},
    )
    assert resp.status_code == 200, resp.text


def _seed_analysed_conversation(user_id: str, project_id: str, topic: str) -> str:
    analysis = {
        "topic": topic,
        "summary": "The learner practised the preterite.",
        "user_level": "intermediate",
        "strengths": ["vocabulary recall"],
        "weaknesses": ["irregular verbs"],
        "error_patterns": ["confuses ser/estar"],
        "vocabulary": [{"word": "tener", "translation": "to have"}],
        "suggested_curriculum": [{"title": "Irregular preterite drill", "priority": 1}],
    }
    db = SessionLocal()
    try:
        conv = ImportedConversation(
            user_id=user_id,
            project_id=project_id,
            source="chatgpt",
            title="My Spanish chat",
            message_count=0,
            analyzed=True,
            analysis_result=json.dumps(analysis),
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
        return conv.id
    finally:
        db.close()


def _mutate_analysis_topic(conv_id: str, new_topic: str) -> None:
    """Simulate a context change after the session started: re-analysis (or any
    later edit) changes the imported conversation's analysis topic."""
    db = SessionLocal()
    try:
        conv = db.get(ImportedConversation, conv_id)
        parsed = json.loads(conv.analysis_result)
        parsed["topic"] = new_topic
        conv.analysis_result = json.dumps(parsed)
        db.commit()
    finally:
        db.close()


def _seed_lesson_progress(user_id: str) -> None:
    db = SessionLocal()
    try:
        db.add(
            LessonProgress(
                user_id=user_id,
                source="bundled:adaptive-learner-content",
                set_id="language-es-a1",
                lesson_filename="03-articles.json",
                status="in_progress",
                step_results="{}",
                score_correct=0,
                score_total=0,
                time_spent_seconds=30,
                current_step=2,
            )
        )
        db.add(
            ElementError(
                user_id=user_id,
                set_id="language-es-a1",
                lesson_id="03-articles",
                exercise_id="ex1",
                element_key="el",
                direction="target_to_source",
                element_type="vocab",
                user_answer="la",
                correct_answer="el",
                error_count=2,
                correct_streak=0,
                mastered=False,
            )
        )
        db.commit()
    finally:
        db.close()


# --- 1a: #797 suppression for imported sessions ---------------------------


def test_imported_session_start_skips_learning_context(client: TestClient):
    """#1137-Pendant: an imported session must NOT fold the lesson-progress
    block (#797) into its prompt, even when the learner has lesson activity."""
    user_id, project_id = _make_user_and_project(client)
    _seed_lesson_progress(user_id)
    conv_id = _seed_analysed_conversation(user_id, project_id, topic="Spanish past tense")

    resp = client.post(
        "/api/plugins/session/start",
        json={
            "project_id": project_id,
            "method": "deductive",
            "lang": "en",
            "imported_conversation_id": conv_id,
        },
    )
    assert resp.status_code in (200, 201), resp.text
    prompt = resp.json()["system_prompt"]

    # Imported context present, lesson-progress block suppressed.
    assert "Spanish past tense" in prompt
    assert "LEARNING CONTEXT" not in prompt
    assert "Currently working on" not in prompt


def test_normal_session_start_includes_learning_context(client: TestClient):
    """Contrast to the above: a non-imported session for the same learner DOES
    fold in the lesson-progress block."""
    user_id, project_id = _make_user_and_project(client)
    _seed_lesson_progress(user_id)

    resp = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": "deductive", "lang": "en"},
    )
    assert resp.status_code in (200, 201), resp.text
    prompt = resp.json()["system_prompt"]
    assert "LEARNING CONTEXT" in prompt
    assert "Currently working on" in prompt


# --- 1b: rebuild-on-resume sends fresh context on a later turn ------------


def test_imported_session_rebuilds_system_prompt_on_later_turn(client: TestClient, capturing_ai):
    """#1122-Pendant: a context change (mutated analysis) reaches the AI on a
    later turn because the system message is rebuilt fresh from the FK instead
    of replaying the frozen persisted copy."""
    user_id, project_id = _make_user_and_project(client)
    _seed_api_key(client, user_id)
    conv_id = _seed_analysed_conversation(user_id, project_id, topic="ORIGINALTOPIC")

    sess_id = client.post(
        "/api/plugins/session/start",
        json={
            "project_id": project_id,
            "method": "deductive",
            "lang": "en",
            "imported_conversation_id": conv_id,
        },
    ).json()["session"]["id"]

    # First turn: the original topic is what the AI sees.
    client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": "Hola"},
    )
    first_systems = [
        call[0]["content"] for call in capturing_ai.calls if call and call[0]["role"] == "system"
    ]
    assert any("ORIGINALTOPIC" in s for s in first_systems)

    # Context changes after the session started.
    _mutate_analysis_topic(conv_id, "REBUILTTOPIC")
    capturing_ai.calls.clear()

    # Second turn: the rebuilt system message carries the mutated topic.
    resp = client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": "Otra pregunta"},
    )
    assert resp.status_code == 201, resp.text
    second_systems = [
        call[0]["content"] for call in capturing_ai.calls if call and call[0]["role"] == "system"
    ]
    assert any("REBUILTTOPIC" in s for s in second_systems)
    assert not any("ORIGINALTOPIC" in s for s in second_systems)


def test_normal_session_replays_persisted_system_prompt(client: TestClient, capturing_ai):
    """A non-imported session is NOT rebuilt: the persisted system message is
    replayed verbatim (only one system message ever reaches the AI)."""
    user_id, project_id = _make_user_and_project(client)
    _seed_api_key(client, user_id)
    sess_id = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": "deductive", "lang": "en"},
    ).json()["session"]["id"]

    client.post(
        f"/api/plugins/session/{sess_id}/message",
        json={"role": "user", "content": "Explain articles."},
    )
    learning_calls = [call for call in capturing_ai.calls if call and call[0]["role"] == "system"]
    assert learning_calls, "expected a learning ai_complete call with a system message"
    # Exactly one system message per learning payload (no duplicate from a rebuild).
    for call in learning_calls:
        assert sum(1 for m in call if m["role"] == "system") == 1


# --- 1c: session GET carries the imported FK ------------------------------


def test_get_session_returns_imported_conversation_id(client: TestClient):
    """#1147-Pendant: the session DTO carries imported_conversation_id so the
    API-mode header topic + intro can resolve the import."""
    user_id, project_id = _make_user_and_project(client)
    conv_id = _seed_analysed_conversation(user_id, project_id, topic="Spanish past tense")

    sess_id = client.post(
        "/api/plugins/session/start",
        json={
            "project_id": project_id,
            "method": "deductive",
            "lang": "en",
            "imported_conversation_id": conv_id,
        },
    ).json()["session"]["id"]

    fetched = client.get(f"/api/plugins/session/{sess_id}")
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["imported_conversation_id"] == conv_id


def test_get_session_imported_conversation_id_null_for_normal_session(client: TestClient):
    _user_id, project_id = _make_user_and_project(client)
    sess_id = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": "deductive"},
    ).json()["session"]["id"]

    fetched = client.get(f"/api/plugins/session/{sess_id}")
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["imported_conversation_id"] is None
