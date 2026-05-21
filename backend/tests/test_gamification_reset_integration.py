"""Phase 29D integration: gamification reset endpoint."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import UserBadge, UserStreak, UserXP


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user_and_project(client: TestClient) -> tuple[str, str]:
    u = client.post("/api/users", json={"name": "ResetTester"})
    user_id = u.json()["id"]
    p = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Reset",
            "goal": "Be reset.",
            "timeframe": "1 week",
            "daily_minutes": 30,
        },
    )
    return user_id, p.json()["id"]


def _run_one_session(client: TestClient, project_id: str) -> None:
    sess_id = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": "deductive"},
    ).json()["session"]["id"]
    client.post(
        f"/api/plugins/session/{sess_id}/rate",
        json={"understanding": 4, "stress": 2, "method_fit": 4},
    )
    client.post(f"/api/plugins/session/{sess_id}/end")


def test_reset_wipes_xp_badges_streak(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id)
    db = SessionLocal()
    try:
        # Sanity: one row each before reset.
        assert db.query(UserXP).filter(UserXP.user_id == user_id).count() == 1
        assert (
            db.query(UserBadge).filter(UserBadge.user_id == user_id).count() >= 1
        )
        assert (
            db.query(UserStreak).filter(UserStreak.user_id == user_id).count() == 1
        )
    finally:
        db.close()

    r = client.post(f"/api/plugins/gamification/reset/{user_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["xp_deleted"] == 1
    assert body["badges_deleted"] >= 1
    assert body["streak_deleted"] == 1

    db = SessionLocal()
    try:
        assert db.query(UserXP).filter(UserXP.user_id == user_id).count() == 0
        assert (
            db.query(UserBadge).filter(UserBadge.user_id == user_id).count() == 0
        )
        assert (
            db.query(UserStreak).filter(UserStreak.user_id == user_id).count() == 0
        )
    finally:
        db.close()


def test_reset_rejects_unknown_user(client: TestClient) -> None:
    r = client.post("/api/plugins/gamification/reset/nope")
    assert r.status_code == 404


def test_reset_is_idempotent(client: TestClient) -> None:
    """Calling reset twice in a row returns zero counts the
    second time but doesn't error."""
    user_id, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id)
    client.post(f"/api/plugins/gamification/reset/{user_id}")
    r = client.post(f"/api/plugins/gamification/reset/{user_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["xp_deleted"] == 0
    assert body["badges_deleted"] == 0
    assert body["streak_deleted"] == 0
