"""Integration tests for the gamification dashboard API (#572).

Pins the four ``/api/gamification/*`` aggregation endpoints CCW's
dashboard widgets consume: xp-history (activity-derived daily XP),
streak (current/longest + active days), badges (catalog + progress),
and the compact summary that bundles all three.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import LessonProgress


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user(client: TestClient) -> str:
    return client.post("/api/users", json={"name": "DashTester"}).json()["id"]


def _add_completed_lesson(
    user_id: str,
    *,
    when: datetime,
    correct: int = 10,
    total: int = 10,
    filename: str = "01-intro.json",
) -> None:
    db = SessionLocal()
    try:
        db.add(
            LessonProgress(
                user_id=user_id,
                source="bundled:adaptive-learner-content",
                set_id="es-a1-from-en",
                lesson_filename=filename,
                status="completed",
                step_results="[]",
                score_correct=correct,
                score_total=total,
                time_spent_seconds=120,
                current_step=0,
                started_at=when,
                updated_at=when,
                completed_at=when,
            )
        )
        db.commit()
    finally:
        db.close()


# --- routing / validation --------------------------------------------------


def test_unknown_user_404s(client: TestClient) -> None:
    for path in ("xp-history", "streak", "badges", "summary"):
        resp = client.get(f"/api/gamification/{path}", params={"user_id": "nope"})
        assert resp.status_code == 404, path


def test_user_id_is_required(client: TestClient) -> None:
    resp = client.get("/api/gamification/xp-history")
    assert resp.status_code == 422


# --- xp-history ------------------------------------------------------------


def test_xp_history_has_30_contiguous_days(client: TestClient) -> None:
    user_id = _make_user(client)
    data = client.get("/api/gamification/xp-history", params={"user_id": user_id}).json()
    assert len(data) == 30
    # Contiguous, ascending, all zero with no activity, cumulative flat.
    assert all(point["xp_earned"] == 0 for point in data)
    assert all(point["total_xp"] == 0 for point in data)
    dates = [point["date"] for point in data]
    assert dates == sorted(dates)


def test_xp_history_credits_completed_lessons_per_day(client: TestClient) -> None:
    user_id = _make_user(client)
    today = datetime.now(UTC)
    _add_completed_lesson(user_id, when=today, filename="01.json")
    _add_completed_lesson(user_id, when=today - timedelta(days=3), filename="02.json")

    data = client.get("/api/gamification/xp-history", params={"user_id": user_id}).json()
    earned_days = [p for p in data if p["xp_earned"] > 0]
    assert len(earned_days) == 2
    # A perfect (3-star) lesson is worth at least base(30)+stars(30).
    assert all(p["xp_earned"] >= 60 for p in earned_days)
    # Running total is monotonic non-decreasing and ends at the sum.
    totals = [p["total_xp"] for p in data]
    assert totals == sorted(totals)
    assert totals[-1] == sum(p["xp_earned"] for p in data)


# --- streak ----------------------------------------------------------------


def test_streak_shape_and_active_days(client: TestClient) -> None:
    user_id = _make_user(client)
    _add_completed_lesson(user_id, when=datetime.now(UTC))
    data = client.get("/api/gamification/streak", params={"user_id": user_id}).json()
    assert set(data) == {"current", "longest", "activeDays"}
    assert isinstance(data["current"], int)
    assert isinstance(data["longest"], int)
    today_iso = datetime.now(UTC).date().isoformat()
    assert today_iso in data["activeDays"]


# --- badges ----------------------------------------------------------------


def test_badges_shape_and_progress(client: TestClient) -> None:
    user_id = _make_user(client)
    _add_completed_lesson(user_id, when=datetime.now(UTC))
    badges = client.get("/api/gamification/badges", params={"user_id": user_id}).json()
    assert badges, "catalog should be non-empty"
    by_id = {b["id"]: b for b in badges}
    sample = badges[0]
    assert set(sample) >= {"id", "name", "description", "earned", "earned_at", "progress"}

    first_lesson = by_id["first_lesson"]
    assert first_lesson["progress"] == {"current": 1, "required": 1}

    # A high-threshold badge stays locked with partial progress.
    sessions_100 = by_id["sessions_100"]
    assert sessions_100["earned"] is False
    assert sessions_100["progress"]["required"] == 100
    assert sessions_100["progress"]["current"] <= 100


def test_dynamic_tier_badge_progress_targets_next_tier(client: TestClient) -> None:
    user_id = _make_user(client)
    _add_completed_lesson(user_id, when=datetime.now(UTC))
    badges = client.get("/api/gamification/badges", params={"user_id": user_id}).json()
    lessons = {b["id"]: b for b in badges}["lessons_10"]
    # One completed lesson -> required is the next tier (bronze, 10).
    assert lessons["progress"]["current"] == 1
    assert lessons["progress"]["required"] == 10


# --- summary ---------------------------------------------------------------


def test_summary_bundles_all_three(client: TestClient) -> None:
    user_id = _make_user(client)
    _add_completed_lesson(user_id, when=datetime.now(UTC))
    data = client.get("/api/gamification/summary", params={"user_id": user_id}).json()
    assert set(data) == {"xp", "xp_history", "streak", "badges"}
    assert set(data["xp"]) == {"total_xp", "level"}
    assert len(data["xp_history"]) == 30
    assert set(data["streak"]) == {"current", "longest", "activeDays"}
    assert isinstance(data["badges"], list) and data["badges"]
