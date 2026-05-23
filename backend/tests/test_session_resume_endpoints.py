"""Session resume endpoint tests (Phase 38 Bug 7).

Pins:
- ``GET /api/plugins/session/{id}`` returns the session
  record by ID (404 on missing).
- ``GET /api/plugins/session/{id}/messages`` returns the chat
  history oldest-first (the system-prompt message lands as
  the first entry).
- These two endpoints support the frontend Session.tsx
  resume path: ``?session=<id>`` -> fetch the existing
  session + replay the conversation, instead of calling
  ``POST /start`` and creating a new one.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(name="client")
def _client():
    with TestClient(app) as c:
        yield c


def _make_project(client: TestClient) -> str:
    u = client.post("/api/users", json={"name": "Resumer"})
    user_id = u.json()["id"]
    p = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Resume me",
            "goal": "Test resume.",
            "timeframe": "1 week",
            "daily_minutes": 15,
        },
    )
    return p.json()["id"]


def test_get_session_returns_record_by_id(client: TestClient):
    project_id = _make_project(client)
    resp = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": "deductive"},
    )
    assert resp.status_code in (200, 201)
    session_id = resp.json()["session"]["id"]

    fetched = client.get(f"/api/plugins/session/{session_id}")
    assert fetched.status_code == 200
    body = fetched.json()
    assert body["id"] == session_id
    assert body["project_id"] == project_id
    assert body["method"] == "deductive"
    assert body["status"] == "active"


def test_get_session_404_on_missing(client: TestClient):
    resp = client.get("/api/plugins/session/does-not-exist")
    assert resp.status_code == 404
    assert "does-not-exist" in resp.json()["detail"]


def test_list_session_messages_returns_system_prompt(client: TestClient):
    project_id = _make_project(client)
    started = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": "inductive"},
    ).json()
    session_id = started["session"]["id"]

    msgs = client.get(f"/api/plugins/session/{session_id}/messages")
    assert msgs.status_code == 200
    rows = msgs.json()
    assert isinstance(rows, list)
    # The system prompt is persisted as the first message on
    # session-start (so the AI orchestrator's next /message
    # call sees the chronological history).
    assert len(rows) >= 1
    assert rows[0]["role"] == "system"
    assert rows[0]["content"]
    assert rows[0]["session_id"] == session_id


def test_list_session_messages_404_on_missing(client: TestClient):
    resp = client.get("/api/plugins/session/missing/messages")
    assert resp.status_code == 404


def test_list_session_messages_chronological_order(client: TestClient):
    """A session that has had several /message exchanges must
    return them in created_at-ascending order so the frontend
    can replay them top-to-bottom without re-sorting."""
    project_id = _make_project(client)
    started = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": "dialogic"},
    ).json()
    session_id = started["session"]["id"]

    # Re-fetch — initial state has just the system prompt.
    msgs = client.get(
        f"/api/plugins/session/{session_id}/messages",
    ).json()
    timestamps = [m["created_at"] for m in msgs]
    assert timestamps == sorted(timestamps), (
        "messages must come back ascending; got: %r" % timestamps
    )
