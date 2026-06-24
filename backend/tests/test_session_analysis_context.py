"""Integration: a session started from an analysed chat import carries
the analysis in its system prompt (continue-session-after-import fix).

Before this fix, ``POST /api/plugins/session/start`` set the
``imported_conversation_id`` FK but built the system prompt from the
project + profile only, so the AI opened with zero awareness of the
imported chat. The learner had to start from scratch.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import ImportedConversation, ImportedMessage


@pytest.fixture(name="client")
def _client():
    with TestClient(app) as c:
        yield c


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


def _seed_analysed_conversation(user_id: str, project_id: str) -> str:
    analysis = {
        "topic": "Spanish past tense",
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


def _seed_conversation_messages(conv_id: str) -> None:
    """Attach a short raw transcript to the conversation (#1078)."""
    turns = [
        ("user", "How do I use the preterite of tener?"),
        ("assistant", "It's irregular: tuve, tuviste, tuvo..."),
        ("user", "And hacer?"),
        ("assistant", "Also irregular: hice, hiciste, hizo..."),
    ]
    db = SessionLocal()
    try:
        for i, (role, content) in enumerate(turns):
            db.add(
                ImportedMessage(
                    conversation_id=conv_id,
                    role=role,
                    content=content,
                    order_index=i,
                )
            )
        db.commit()
    finally:
        db.close()


def test_start_with_import_injects_analysis_into_system_prompt(client: TestClient):
    user_id, project_id = _make_user_and_project(client)
    conv_id = _seed_analysed_conversation(user_id, project_id)

    resp = client.post(
        "/api/plugins/session/start",
        json={
            "project_id": project_id,
            "method": "deductive",
            "lang": "de",
            "imported_conversation_id": conv_id,
        },
    )
    assert resp.status_code in (200, 201), resp.text
    system_prompt = resp.json()["system_prompt"]

    # The analysis context is folded into the system prompt.
    assert "Spanish past tense" in system_prompt
    assert "Schwächen: irregular verbs" in system_prompt
    assert "Fehlermuster: confuses ser/estar" in system_prompt
    assert "tener" in system_prompt
    assert "Setze die Lernsitzung fort" in system_prompt


def test_start_with_import_injects_raw_transcript(client: TestClient):
    """#1078 — the raw imported chat transcript (not just the analysis
    summary) is folded into the system prompt so the tutor can continue the
    actual conversation."""
    user_id, project_id = _make_user_and_project(client)
    conv_id = _seed_analysed_conversation(user_id, project_id)
    _seed_conversation_messages(conv_id)

    resp = client.post(
        "/api/plugins/session/start",
        json={
            "project_id": project_id,
            "method": "deductive",
            "lang": "de",
            "imported_conversation_id": conv_id,
        },
    )
    assert resp.status_code in (200, 201), resp.text
    system_prompt = resp.json()["system_prompt"]

    # The raw transcript block + its turns are present, alongside the summary.
    assert "Importierte Konversation" in system_prompt
    assert "Lerner: How do I use the preterite of tener?" in system_prompt
    assert "Assistent: Also irregular: hice, hiciste, hizo..." in system_prompt
    assert "Knüpfe an diese vorherige Konversation an" in system_prompt


def test_start_without_import_has_no_analysis_block(client: TestClient):
    _user_id, project_id = _make_user_and_project(client)
    resp = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": "deductive", "lang": "de"},
    )
    assert resp.status_code in (200, 201), resp.text
    system_prompt = resp.json()["system_prompt"]
    assert "Setze die Lernsitzung fort" not in system_prompt
    # #1078 — no import → no raw-transcript block either.
    assert "Importierte Konversation" not in system_prompt


def test_resume_returns_the_analysis_carrying_prompt(client: TestClient):
    """A second start for the same conversation resumes the existing
    session and returns its (analysis-carrying) system prompt — no
    duplicate session, context preserved."""
    user_id, project_id = _make_user_and_project(client)
    conv_id = _seed_analysed_conversation(user_id, project_id)

    first = client.post(
        "/api/plugins/session/start",
        json={
            "project_id": project_id,
            "method": "deductive",
            "lang": "de",
            "imported_conversation_id": conv_id,
        },
    ).json()
    second = client.post(
        "/api/plugins/session/start",
        json={
            "project_id": project_id,
            "method": "deductive",
            "lang": "de",
            "imported_conversation_id": conv_id,
        },
    ).json()

    # Same session (resume, no duplicate) and the analysis survives.
    assert second["session"]["id"] == first["session"]["id"]
    assert "Spanish past tense" in second["system_prompt"]
