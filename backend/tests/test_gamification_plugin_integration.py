"""Phase 29A integration: gamification plugin under app.main.app.

Pins:

1. Closing a session via POST ``/api/plugins/session/{id}/end``
   auto-creates the user_xp row and credits the base 50 XP (no
   streak, no first-method bonus on the second-in-method session).
2. The first session in a new method earns the +50 first-method
   bonus.
3. The award-assessment and award-import endpoints add the flat
   amounts and the level recalculates.
4. The dashboard ``/api/plugins/tracking/progress/{project_id}``
   surface includes the ``gamification`` namespace contributed by
   ``get_progress_summary``.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app, manager
from app.models import UserXP


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user_and_project(client: TestClient) -> tuple[str, str]:
    u = client.post("/api/users", json={"name": "XPTester"})
    user_id = u.json()["id"]
    p = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Gamification",
            "goal": "Earn XP.",
            "timeframe": "1 week",
            "daily_minutes": 30,
        },
    )
    return user_id, p.json()["id"]


def _run_one_session(
    client: TestClient,
    project_id: str,
    *,
    method: str = "deductive",
) -> str:
    sess_id = client.post(
        "/api/plugins/session/start",
        json={"project_id": project_id, "method": method},
    ).json()["session"]["id"]
    client.post(
        f"/api/plugins/session/{sess_id}/rate",
        json={"understanding": 4, "stress": 2, "method_fit": 4},
    )
    client.post(f"/api/plugins/session/{sess_id}/end")
    return sess_id


# --- Plugin wiring ---------------------------------------------------------


def test_plugin_is_active(client: TestClient) -> None:
    active = {p.name for p in manager.get_active_plugins()}
    assert "gamification" in active


def test_router_paths_mounted(client: TestClient) -> None:
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/plugins/gamification/xp/{user_id}" in paths
    assert "/api/plugins/gamification/xp/{user_id}/award-assessment" in paths
    assert "/api/plugins/gamification/xp/{user_id}/award-import" in paths


# --- on_session_complete awards XP ----------------------------------------


def test_first_completed_session_creates_user_xp_row(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id, method="deductive")

    db = SessionLocal()
    try:
        rows = db.query(UserXP).filter(UserXP.user_id == user_id).all()
        assert len(rows) == 1
        row = rows[0]
        # Base 50 + first-method bonus 50 + 1-day streak multiplier 1.25 == 125
        assert row.total_xp == 125
        assert row.level == 2  # 100 threshold crossed
    finally:
        db.close()


def test_xp_state_endpoint_after_first_session(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id, method="inductive")
    state = client.get(f"/api/plugins/gamification/xp/{user_id}").json()
    assert state["total_xp"] == 125
    assert state["level"] == 2
    assert state["next_level_threshold"] == 300
    # 125 - 100 = 25 into level 2
    assert state["xp_into_level"] == 25


def test_second_session_in_same_method_no_first_method_bonus(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id, method="deductive")
    _run_one_session(client, project_id, method="deductive")

    state = client.get(f"/api/plugins/gamification/xp/{user_id}").json()
    # First session: 50 + 50 (first-method) = 100, then * 1.25 = 125
    # Second session: 50 (no first-method, same day so streak stays
    # at 1 day), * 1.25 = 62.5 -> 62 via Python's banker's rounding
    # (``round(62.5)`` returns 62 since 62 is even). Total 187.
    assert state["total_xp"] == 187


def test_second_method_first_session_earns_first_method_bonus(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id, method="deductive")
    _run_one_session(client, project_id, method="dialogic")
    state = client.get(f"/api/plugins/gamification/xp/{user_id}").json()
    # 125 (deductive first-method) + 125 (dialogic first-method) = 250
    assert state["total_xp"] == 250


# --- award-assessment / award-import flat earns ---------------------------


def test_award_assessment_grants_one_hundred(client: TestClient) -> None:
    user_id, _ = _make_user_and_project(client)
    r = client.post(f"/api/plugins/gamification/xp/{user_id}/award-assessment")
    assert r.status_code == 200
    body = r.json()
    assert body["xp_earned"] == 100
    assert body["xp_total"] == 100
    assert body["level"] == 2
    assert body["level_up"] is True
    assert body["reason"] == "assessment_complete"


def test_award_import_grants_seventy_five(client: TestClient) -> None:
    user_id, _ = _make_user_and_project(client)
    r = client.post(f"/api/plugins/gamification/xp/{user_id}/award-import")
    assert r.status_code == 200
    body = r.json()
    assert body["xp_earned"] == 75
    assert body["xp_total"] == 75
    assert body["level"] == 1
    assert body["level_up"] is False


def test_manual_award_supports_negative_for_reset(client: TestClient) -> None:
    user_id, _ = _make_user_and_project(client)
    client.post(f"/api/plugins/gamification/xp/{user_id}/award-assessment")
    state_before = client.get(f"/api/plugins/gamification/xp/{user_id}").json()
    assert state_before["total_xp"] == 100
    r = client.post(
        f"/api/plugins/gamification/xp/{user_id}/award",
        json={"amount": -100, "reason": "reset"},
    )
    assert r.status_code == 200
    state_after = client.get(f"/api/plugins/gamification/xp/{user_id}").json()
    assert state_after["total_xp"] == 0
    assert state_after["level"] == 1


def test_award_endpoints_reject_unknown_user(client: TestClient) -> None:
    r = client.post("/api/plugins/gamification/xp/nope/award-assessment")
    assert r.status_code == 404


def test_xp_state_for_unknown_user_returns_404(client: TestClient) -> None:
    r = client.get("/api/plugins/gamification/xp/nope")
    assert r.status_code == 404


# --- get_progress_summary contribution ------------------------------------


def test_dashboard_progress_includes_gamification_namespace(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id, method="deductive")
    progress = client.get(f"/api/plugins/tracking/progress/{project_id}").json()
    assert "gamification" in progress
    gam = progress["gamification"]
    assert gam["user_id"] == user_id
    assert gam["total_xp"] == 125
    assert gam["level"] == 2
