"""The last ten learner actions on a lesson row (#3365).

An action is a ``step_event`` on the upsert: arriving on a step, a graded
answer, a pause, an exit, a confirmed restart, reaching the summary. The
row keeps the ten most recent ones in ``recent_steps``; consecutive
identical ``step`` entries collapse into one. The frontend resumes on the
last ``step`` entry's ``step_id``.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app

SOURCE = "astrapi69/adaptive-learner-content"
SET_ID = "language-fr-a1"
LESSON = "01-greetings.json"


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user(client: TestClient) -> str:
    response = client.post("/api/users", json={"name": "Tester", "language": "en"})
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


def _upsert(client: TestClient, user_id: str, **extra: Any) -> dict[str, Any]:
    response = client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={"source": SOURCE, "set_id": SET_ID, "lesson_filename": LESSON, **extra},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _step(index: int) -> dict[str, Any]:
    return {"kind": "step", "step_index": index, "step_id": f"s{index}"}


def test_step_event_is_recorded_with_a_server_timestamp(client: TestClient) -> None:
    user_id = _make_user(client)
    body = _upsert(client, user_id, current_step=2, step_event=_step(2))
    assert len(body["recent_steps"]) == 1
    entry = body["recent_steps"][0]
    assert entry["kind"] == "step"
    assert entry["step_index"] == 2
    assert entry["step_id"] == "s2"
    assert isinstance(entry["at"], str) and entry["at"]


def test_answer_event_keeps_correct_flag(client: TestClient) -> None:
    user_id = _make_user(client)
    body = _upsert(
        client,
        user_id,
        step_result={"step_id": "s1", "correct": 0, "total": 1},
        step_event={"kind": "answer", "step_index": 1, "step_id": "s1", "correct": False},
    )
    assert body["recent_steps"][-1]["kind"] == "answer"
    assert body["recent_steps"][-1]["correct"] is False


@pytest.mark.parametrize(
    "sent, kept",
    [(0, 0), (1, 1), (10, 10), (11, 10), (25, 10)],
    ids=["none", "one", "exactly-cap", "one-over-cap", "far-over-cap"],
)
def test_recent_steps_keep_only_the_newest_ten(client: TestClient, sent: int, kept: int) -> None:
    user_id = _make_user(client)
    body = _upsert(client, user_id, current_step=0)
    for index in range(sent):
        body = _upsert(client, user_id, current_step=index, step_event=_step(index))
    steps = body["recent_steps"]
    assert len(steps) == kept
    assert [entry["step_index"] for entry in steps] == list(range(sent - kept, sent))


def test_consecutive_identical_step_events_collapse(client: TestClient) -> None:
    user_id = _make_user(client)
    _upsert(client, user_id, step_event=_step(3))
    body = _upsert(client, user_id, step_event=_step(3))
    assert [entry["step_index"] for entry in body["recent_steps"]] == [3]


def test_an_action_between_two_identical_steps_keeps_both(client: TestClient) -> None:
    user_id = _make_user(client)
    _upsert(client, user_id, step_event=_step(3))
    _upsert(client, user_id, step_event={"kind": "pause", "step_index": 3, "step_id": "s3"})
    body = _upsert(client, user_id, step_event=_step(3))
    assert [entry["kind"] for entry in body["recent_steps"]] == ["step", "pause", "step"]


def test_restart_keeps_the_history_and_logs_itself(client: TestClient) -> None:
    user_id = _make_user(client)
    _upsert(client, user_id, step_event=_step(4))
    body = _upsert(
        client,
        user_id,
        mark_restarted=True,
        step_event={"kind": "restart", "step_index": 4, "step_id": "s4"},
    )
    assert [entry["kind"] for entry in body["recent_steps"]] == ["step", "restart"]
    assert body["current_step"] == 0


def test_upsert_without_event_leaves_recent_steps_unchanged(client: TestClient) -> None:
    user_id = _make_user(client)
    _upsert(client, user_id, step_event=_step(1))
    body = _upsert(client, user_id, time_spent_seconds_delta=30)
    assert [entry["step_index"] for entry in body["recent_steps"]] == [1]


def test_fresh_row_reports_an_empty_list(client: TestClient) -> None:
    user_id = _make_user(client)
    assert _upsert(client, user_id, current_step=0)["recent_steps"] == []


@pytest.mark.parametrize(
    "event",
    [
        {"kind": "hint", "step_index": 0},
        {"kind": "step", "step_index": -1},
        {"kind": "step"},
    ],
    ids=["unknown-kind", "negative-index", "missing-index"],
)
def test_malformed_event_is_rejected(client: TestClient, event: dict[str, Any]) -> None:
    user_id = _make_user(client)
    response = client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": SET_ID,
            "lesson_filename": LESSON,
            "step_event": event,
        },
    )
    assert response.status_code == 422
