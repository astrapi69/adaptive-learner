"""Phase 29B integration: badge catalog + evaluation.

Pins:

1. Seed YAML loads + ``seed_catalog`` creates one row per badge
   on first call AND is idempotent on re-call.
2. Every catalog ``key`` has a matching evaluator predicate
   registered.
3. ``GET /api/plugins/gamification/badges/{user_id}`` returns
   the full catalog with per-user earn state.
4. The session-complete hook awards ``first_session`` on the
   first completed session.
5. ``POST /api/plugins/gamification/badges/{user_id}/evaluate``
   force-evaluates and returns the freshly earned keys.
6. Repeated evaluations don't double-award (unique constraint
   on user_id+badge_id holds).
"""

from __future__ import annotations

import pytest
from adaptive_learner_gamification import badge_service
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Badge, UserBadge


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user_and_project(client: TestClient) -> tuple[str, str]:
    u = client.post("/api/users", json={"name": "BadgeTester"})
    user_id = u.json()["id"]
    p = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Badges",
            "goal": "Earn badges.",
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


# --- Seed contract --------------------------------------------------------


def test_seed_catalog_inserts_all_yaml_badges(client: TestClient) -> None:
    """Lifespan seeded the catalog; every YAML key has a row."""
    catalog = badge_service.load_catalog_from_yaml()
    db = SessionLocal()
    try:
        rows = db.query(Badge).all()
        keys = {r.key for r in rows}
        for entry in catalog:
            assert entry["key"] in keys
        # No row appeared that isn't in the YAML.
        yaml_keys = {entry["key"] for entry in catalog}
        for r in rows:
            assert r.key in yaml_keys
    finally:
        db.close()


def test_seed_catalog_is_idempotent(client: TestClient) -> None:
    """Re-running ``seed_catalog`` doesn't duplicate rows."""
    db = SessionLocal()
    try:
        count_before = db.query(Badge).count()
        inserted = badge_service.seed_catalog(db)
        count_after = db.query(Badge).count()
        assert count_before == count_after
        # All rows already match → no inserts AND no field-diff updates.
        assert inserted == 0
    finally:
        db.close()


def test_every_yaml_badge_has_an_evaluator() -> None:
    """A YAML entry without an evaluator would be unobtainable;
    an evaluator without a YAML entry would crash at lookup."""
    catalog = {entry["key"] for entry in badge_service.load_catalog_from_yaml()}
    evaluators = badge_service.evaluator_keys()
    missing_evaluator = catalog - evaluators
    extra_evaluator = evaluators - catalog
    assert not missing_evaluator, f"YAML keys with no evaluator: {sorted(missing_evaluator)}"
    assert not extra_evaluator, f"Evaluators with no YAML entry: {sorted(extra_evaluator)}"


# --- Tier metadata (Phase 57 / v1.40.0) -----------------------------------


def test_seed_persists_tier_metadata(client: TestClient) -> None:
    """The seeder writes ``base_tier`` for every badge + decodable
    ``tier_thresholds`` for the dynamic badges (NULL otherwise)."""
    import json

    db = SessionLocal()
    try:
        by_key = {b.key: b for b in db.query(Badge).all()}
        # Static sibling families carry their fixed visual tier.
        assert by_key["sessions_50"].base_tier == "silver"
        assert by_key["sessions_100"].base_tier == "gold"
        assert by_key["level_10"].base_tier == "silver"
        assert by_key["level_25"].base_tier == "gold"
        assert by_key["streak_7_days"].base_tier == "silver"
        assert by_key["streak_30_days"].base_tier == "gold"
        assert by_key["streak_100_days"].base_tier == "gold"
        # Flat / dynamic badges start at bronze.
        assert by_key["first_session"].base_tier == "bronze"
        assert by_key["lessons_10"].base_tier == "bronze"
        # Dynamic badges carry decodable thresholds; static ones don't.
        assert by_key["first_session"].tier_thresholds is None
        assert by_key["sessions_50"].tier_thresholds is None
        lessons = json.loads(by_key["lessons_10"].tier_thresholds)
        assert lessons["bronze"]["threshold"] == 10
        assert lessons["silver"]["threshold"] == 50
        assert lessons["gold"]["threshold"] == 100
        review = json.loads(by_key["review_master"].tier_thresholds)
        assert review["gold"]["threshold"] == 500
    finally:
        db.close()


def test_new_earn_records_badge_base_tier(client: TestClient) -> None:
    """A freshly earned badge records its catalog ``base_tier`` on the
    UserBadge row (bronze for first_session)."""
    user_id, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id)
    client.post(f"/api/plugins/gamification/badges/{user_id}/evaluate")
    db = SessionLocal()
    try:
        first = db.query(Badge).filter(Badge.key == "first_session").first()
        row = (
            db.query(UserBadge)
            .filter(UserBadge.user_id == user_id, UserBadge.badge_id == first.id)
            .first()
        )
        assert row is not None
        assert row.tier == "bronze"
        assert row.updated_at is not None
    finally:
        db.close()


def test_list_badges_endpoint_exposes_tier_fields(client: TestClient) -> None:
    user_id, _ = _make_user_and_project(client)
    body = client.get(f"/api/plugins/gamification/badges/{user_id}").json()
    by_key = {e["key"]: e for e in body}
    # Locked badge previews its base tier.
    assert by_key["sessions_100"]["base_tier"] == "gold"
    assert by_key["sessions_100"]["tier"] == "gold"
    assert by_key["sessions_100"]["tier_thresholds"] is None
    # Dynamic badge exposes thresholds; locked tier is the base.
    assert by_key["lessons_10"]["tier"] == "bronze"
    assert by_key["lessons_10"]["tier_thresholds"]["silver"]["threshold"] == 50


# --- Endpoint contract ----------------------------------------------------


def test_list_badges_endpoint_returns_full_catalog(client: TestClient) -> None:
    user_id, _ = _make_user_and_project(client)
    r = client.get(f"/api/plugins/gamification/badges/{user_id}")
    assert r.status_code == 200
    body = r.json()
    catalog = badge_service.load_catalog_from_yaml()
    assert len(body) == len(catalog)
    # Pre-earn: every entry is locked.
    for entry in body:
        assert entry["earned"] is False
        assert entry["earned_at"] is None


def test_list_badges_endpoint_rejects_unknown_user(client: TestClient) -> None:
    r = client.get("/api/plugins/gamification/badges/nope")
    assert r.status_code == 404


def test_catalog_endpoint_returns_catalog_without_user_context(
    client: TestClient,
) -> None:
    r = client.get("/api/plugins/gamification/badges")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == len(badge_service.load_catalog_from_yaml())


# --- Hook-fired award -----------------------------------------------------


def test_first_session_badge_lands_on_session_complete(
    client: TestClient,
) -> None:
    user_id, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id)
    body = client.get(f"/api/plugins/gamification/badges/{user_id}").json()
    first_session = next(b for b in body if b["key"] == "first_session")
    assert first_session["earned"] is True
    assert first_session["earned_at"] is not None
    # Streak-3 isn't earned yet (only 1 day of activity).
    streak3 = next(b for b in body if b["key"] == "streak_3_days")
    assert streak3["earned"] is False


def test_repeated_session_does_not_double_award(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id)
    _run_one_session(client, project_id)
    db = SessionLocal()
    try:
        # Even with two completed sessions, only one ``first_session``
        # row exists.
        first_session_badge = db.query(Badge).filter(Badge.key == "first_session").one()
        rows = (
            db.query(UserBadge)
            .filter(UserBadge.user_id == user_id)
            .filter(UserBadge.badge_id == first_session_badge.id)
            .all()
        )
        assert len(rows) == 1
    finally:
        db.close()


# --- Manual evaluation endpoint -------------------------------------------


def test_manual_evaluate_returns_newly_earned_keys(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    _run_one_session(client, project_id)
    # Second call: nothing new (the hook already evaluated).
    r = client.post(f"/api/plugins/gamification/badges/{user_id}/evaluate")
    assert r.status_code == 200
    assert r.json()["earned"] == []


def test_manual_evaluate_rejects_unknown_user(client: TestClient) -> None:
    r = client.post("/api/plugins/gamification/badges/nope/evaluate")
    assert r.status_code == 404
