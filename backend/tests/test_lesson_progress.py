"""LessonProgress model + service + router pins
(Phase 44 / EXP-002 / P-109).

Tests under TestClient — the lifespan must fire so the
Alembic head includes the new ``lesson_progress`` table
the v1.28.0 migration adds.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user(client: TestClient, *, name: str = "Tester") -> str:
    response = client.post(
        "/api/users",
        json={"name": name, "language": "en"},
    )
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


SOURCE = "astrapi69/adaptive-learner-content"
SOURCE_SLUG = "astrapi69--adaptive-learner-content"
SET_ID = "language-fr-a1"
LESSON = "01-greetings.json"


# --- Router wiring ---------------------------------------------------------


def test_router_paths_mounted(client: TestClient) -> None:
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/users/{user_id}/lesson-progress" in paths
    assert (
        "/api/users/{user_id}/lesson-progress/{source_slug}/"
        "{set_id}/{lesson_filename}"
    ) in paths


# --- Empty + 404 paths -----------------------------------------------------


def test_list_empty_for_fresh_user(client: TestClient) -> None:
    user_id = _make_user(client)
    r = client.get(f"/api/users/{user_id}/lesson-progress")
    assert r.status_code == 200
    assert r.json() == []


def test_get_uncached_lesson_returns_404(client: TestClient) -> None:
    user_id = _make_user(client)
    r = client.get(
        f"/api/users/{user_id}/lesson-progress/"
        f"{SOURCE_SLUG}/{SET_ID}/{LESSON}",
    )
    assert r.status_code == 404


def test_get_for_unknown_user_returns_404(client: TestClient) -> None:
    r = client.get(
        "/api/users/no-such-user/lesson-progress/"
        f"{SOURCE_SLUG}/{SET_ID}/{LESSON}",
    )
    assert r.status_code == 404


# --- Upsert + idempotent merge --------------------------------------------


def test_upsert_creates_new_row(client: TestClient) -> None:
    user_id = _make_user(client)
    r = client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": SET_ID,
            "lesson_filename": LESSON,
            "step_result": {
                "step_id": "ex-match-greetings",
                "correct": 4,
                "total": 4,
                "attempts": 1,
            },
            "time_spent_seconds_delta": 30,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user_id"] == user_id
    assert body["source"] == SOURCE
    assert body["set_id"] == SET_ID
    assert body["lesson_filename"] == LESSON
    assert body["status"] == "in_progress"
    assert body["score_correct"] == 4
    assert body["score_total"] == 4
    assert body["time_spent_seconds"] == 30
    assert "ex-match-greetings" in body["step_results"]
    assert body["completed_at"] is None


def test_upsert_round_trips_raw_answer(client: TestClient) -> None:
    """BUG P1 / Problem 2 — the raw answer persists verbatim so a
    revisited step can re-render its exact locked visual."""
    user_id = _make_user(client)
    raw = {"kind": "cloze", "inputs": ["hablo"]}
    r = client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": SET_ID,
            "lesson_filename": LESSON,
            "step_result": {
                "step_id": "ex-cloze",
                "correct": 1,
                "total": 1,
                "raw_answer": raw,
            },
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["step_results"]["ex-cloze"]["raw_answer"] == raw
    # Re-read confirms it survives the JSON encode/decode round-trip.
    g = client.get(
        f"/api/users/{user_id}/lesson-progress/"
        f"{SOURCE_SLUG}/{SET_ID}/{LESSON}"
    )
    assert g.status_code == 200, g.text
    assert g.json()["step_results"]["ex-cloze"]["raw_answer"] == raw


def test_upsert_omits_raw_answer_when_absent(client: TestClient) -> None:
    """A step recorded without a raw answer (legacy shape) stores
    no ``raw_answer`` key."""
    user_id = _make_user(client)
    r = client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": SET_ID,
            "lesson_filename": LESSON,
            "step_result": {"step_id": "s1", "correct": 1, "total": 1},
        },
    )
    assert r.status_code == 200, r.text
    assert "raw_answer" not in r.json()["step_results"]["s1"]


def test_upsert_merges_multiple_steps(client: TestClient) -> None:
    user_id = _make_user(client)
    # Step 1: matching, 4/4
    client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": SET_ID,
            "lesson_filename": LESSON,
            "step_result": {
                "step_id": "ex-match-greetings",
                "correct": 4,
                "total": 4,
            },
            "time_spent_seconds_delta": 30,
        },
    )
    # Step 2: free-text, 0/1 (skipped, then retried wrong)
    r = client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": SET_ID,
            "lesson_filename": LESSON,
            "step_result": {
                "step_id": "ex-free-thanks",
                "correct": 0,
                "total": 1,
                "attempts": 2,
            },
            "time_spent_seconds_delta": 45,
        },
    )
    body = r.json()
    assert set(body["step_results"]) == {
        "ex-match-greetings",
        "ex-free-thanks",
    }
    assert body["score_correct"] == 4
    assert body["score_total"] == 5
    assert body["time_spent_seconds"] == 75
    # Status still in_progress.
    assert body["status"] == "in_progress"
    assert body["completed_at"] is None


def test_mark_completed_flips_status(client: TestClient) -> None:
    user_id = _make_user(client)
    client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": SET_ID,
            "lesson_filename": LESSON,
            "step_result": {
                "step_id": "ex-match-greetings",
                "correct": 4,
                "total": 4,
            },
        },
    )
    r = client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": SET_ID,
            "lesson_filename": LESSON,
            "mark_completed": True,
        },
    )
    body = r.json()
    assert body["status"] == "completed"
    assert body["completed_at"] is not None


def test_upsert_re_recording_same_step_replaces_entry(
    client: TestClient,
) -> None:
    user_id = _make_user(client)
    # First attempt: wrong
    client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": SET_ID,
            "lesson_filename": LESSON,
            "step_result": {
                "step_id": "ex-match-greetings",
                "correct": 2,
                "total": 4,
                "attempts": 1,
            },
        },
    )
    # Retry: nailed it
    r = client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": SET_ID,
            "lesson_filename": LESSON,
            "step_result": {
                "step_id": "ex-match-greetings",
                "correct": 4,
                "total": 4,
                "attempts": 2,
            },
        },
    )
    body = r.json()
    assert body["score_correct"] == 4
    assert body["score_total"] == 4
    assert (
        body["step_results"]["ex-match-greetings"]["attempts"] == 2
    )


# --- Get + list ------------------------------------------------------------


def test_get_after_upsert(client: TestClient) -> None:
    user_id = _make_user(client)
    client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": SET_ID,
            "lesson_filename": LESSON,
            "step_result": {
                "step_id": "ex-1",
                "correct": 1,
                "total": 1,
            },
        },
    )
    r = client.get(
        f"/api/users/{user_id}/lesson-progress/"
        f"{SOURCE_SLUG}/{SET_ID}/{LESSON}",
    )
    assert r.status_code == 200
    body = r.json()
    assert body["set_id"] == SET_ID
    assert body["lesson_filename"] == LESSON


def test_list_returns_every_user_lesson(client: TestClient) -> None:
    user_id = _make_user(client)
    for filename in ("01-greetings.json", "02-numbers.json"):
        client.post(
            f"/api/users/{user_id}/lesson-progress",
            json={
                "source": SOURCE,
                "set_id": SET_ID,
                "lesson_filename": filename,
                "step_result": {
                    "step_id": "ex-1",
                    "correct": 1,
                    "total": 1,
                },
            },
        )
    r = client.get(f"/api/users/{user_id}/lesson-progress")
    assert r.status_code == 200
    listed = r.json()
    filenames = {row["lesson_filename"] for row in listed}
    assert filenames == {"01-greetings.json", "02-numbers.json"}
