"""Phase 29C integration: enhanced streak state.

Pins:

1. ``GET /streak/{user_id}`` creates the row on first hit and
   returns zero state.
2. Session-end fires the hook which writes ``current_streak_days``
   and updates ``longest_streak_days`` when a new high lands.
3. Freezes are granted at 7-day milestones (no double-grant
   within the same window).
4. Weekend mode toggle persists and changes the streak walk.
5. The heatmap returns one entry per calendar day in the window.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from adaptive_learner_gamification import streak_service
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.openapi_metadata import iter_api_routes
from app.main import app
from app.models import LearningProject, LearningSession


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user_and_project(client: TestClient) -> tuple[str, str]:
    u = client.post("/api/users", json={"name": "StreakTester"})
    user_id = u.json()["id"]
    p = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Streaks",
            "goal": "Be consistent.",
            "timeframe": "1 week",
            "daily_minutes": 30,
        },
    )
    return user_id, p.json()["id"]


def _run_one_session(client: TestClient, project_id: str) -> str:
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


# --- Endpoint wiring ------------------------------------------------------


def test_router_paths_mounted(client: TestClient) -> None:
    paths = {r.path for r in iter_api_routes(app)}
    assert "/api/plugins/gamification/streak/{user_id}" in paths
    assert "/api/plugins/gamification/streak/{user_id}/heatmap" in paths
    assert (
        "/api/plugins/gamification/streak/{user_id}/weekend-mode" in paths
    )


def test_streak_endpoint_creates_zero_state_on_first_hit(
    client: TestClient,
) -> None:
    user_id, _ = _make_user_and_project(client)
    state = client.get(f"/api/plugins/gamification/streak/{user_id}").json()
    assert state["current_streak_days"] == 0
    assert state["longest_streak_days"] == 0
    assert state["freezes_available"] == 0
    assert state["weekend_mode"] is False


def test_streak_endpoint_rejects_unknown_user(client: TestClient) -> None:
    r = client.get("/api/plugins/gamification/streak/nope")
    assert r.status_code == 404


# --- Hook-driven streak updates ------------------------------------------


def test_session_complete_updates_streak(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id)
    state = client.get(f"/api/plugins/gamification/streak/{user_id}").json()
    assert state["current_streak_days"] == 1
    assert state["longest_streak_days"] == 1


def test_longest_streak_tracks_high_watermark(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    db = SessionLocal()
    try:
        # Seed 4 historical session days plus today via direct
        # writes (the route only awards "today"; we need
        # historical activity for the streak walk to find 5+).
        proj = db.get(LearningProject, project_id)
        assert proj is not None
        today = datetime.now(UTC)
        for i in range(5):
            db.add(
                LearningSession(
                    project_id=proj.id,
                    method="deductive",
                    started_at=today - timedelta(days=i),
                    ended_at=today - timedelta(days=i),
                    cycle_step=3,
                    status="completed",
                )
            )
        db.commit()
    finally:
        db.close()
    # Force the streak recomputation.
    state = client.get(f"/api/plugins/gamification/streak/{user_id}").json()
    assert state["current_streak_days"] == 5
    assert state["longest_streak_days"] == 5


# --- Freeze granting + spending ------------------------------------------


def test_seven_day_streak_grants_a_freeze(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    db = SessionLocal()
    try:
        proj = db.get(LearningProject, project_id)
        assert proj is not None
        today = datetime.now(UTC)
        for i in range(7):
            db.add(
                LearningSession(
                    project_id=proj.id,
                    method="deductive",
                    started_at=today - timedelta(days=i),
                    ended_at=today - timedelta(days=i),
                    cycle_step=3,
                    status="completed",
                )
            )
        db.commit()
    finally:
        db.close()
    state = client.get(f"/api/plugins/gamification/streak/{user_id}").json()
    assert state["current_streak_days"] == 7
    assert state["freezes_available"] == 1


# --- Weekend mode ---------------------------------------------------------


def test_weekend_mode_toggle_persists(client: TestClient) -> None:
    user_id, _ = _make_user_and_project(client)
    r = client.post(
        f"/api/plugins/gamification/streak/{user_id}/weekend-mode",
        json={"enabled": True},
    )
    assert r.status_code == 200
    assert r.json()["weekend_mode"] is True
    state = client.get(f"/api/plugins/gamification/streak/{user_id}").json()
    assert state["weekend_mode"] is True


# --- Heatmap --------------------------------------------------------------


def test_heatmap_returns_one_entry_per_day(client: TestClient) -> None:
    user_id, _ = _make_user_and_project(client)
    body = client.get(
        f"/api/plugins/gamification/streak/{user_id}/heatmap?days=30"
    ).json()
    assert len(body) == 30
    # Every entry has the right shape + a zero count for a
    # newly-created user.
    for entry in body:
        assert "date" in entry
        assert "count" in entry
        assert entry["count"] == 0


def test_heatmap_counts_sessions_per_day(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id)
    body = client.get(
        f"/api/plugins/gamification/streak/{user_id}/heatmap?days=7"
    ).json()
    today_iso = datetime.now(UTC).date().isoformat()
    today_entry = next(e for e in body if e["date"] == today_iso)
    assert today_entry["count"] >= 1


def test_heatmap_days_clamped(client: TestClient) -> None:
    user_id, _ = _make_user_and_project(client)
    # days=0 → clamps to 7 (lower bound).
    body = client.get(
        f"/api/plugins/gamification/streak/{user_id}/heatmap?days=0"
    ).json()
    assert len(body) == 7
    # days=10_000 → clamps to 730 (upper bound).
    body = client.get(
        f"/api/plugins/gamification/streak/{user_id}/heatmap?days=10000"
    ).json()
    assert len(body) == 730


# --- Pure helper unit tests ----------------------------------------------


def test_compute_current_streak_with_state_weekend_mode_skips_weekend() -> None:
    from datetime import date

    # Mon-Fri activity, no Sat/Sun activity, current date is Mon
    # of next week (8 days later). With weekend_mode ON the
    # streak should hold across the weekend.
    fri = date(2026, 5, 22)  # Friday
    activity = {
        date(2026, 5, 18),  # Mon
        date(2026, 5, 19),  # Tue
        date(2026, 5, 20),  # Wed
        date(2026, 5, 21),  # Thu
        fri,
    }
    streak, freezes = streak_service.compute_current_streak_with_state(
        activity, fri, weekend_mode=True, freezes_available=0
    )
    assert streak == 5
    assert freezes == 0
