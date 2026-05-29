"""Phase 46E.2 / v1.31.0 — content-lesson badge predicates.

Pins the four new badges that ship with v1.31.0:

- ``first_lesson`` (getting_started): >= 1 completed
  LessonProgress.
- ``lessons_10`` (depth): >= 10 completed LessonProgress.
- ``three_star_streak`` (consistency): the most recently
  completed 3 LessonProgress rows ALL score >= 90%
  (3-star band).
- ``review_master`` (depth): >= 50 ``ElementError`` rows
  flipped to ``mastered=True``.

The first three are exercised end-to-end via the
``POST /api/users/{id}/lesson-progress`` endpoint (the
same call site the lesson viewer uses), so the chain
``upsert_progress -> lesson_session_unification ->
on_session_complete -> badge_service.evaluate_user``
runs as it would in production. The fourth (review_master)
seeds ``ElementError`` rows directly + force-evaluates
because a 50-element grind end-to-end is too slow for a
unit test.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import ElementError


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user(client: TestClient, name: str) -> str:
    response = client.post(
        "/api/users",
        json={"name": name, "language": "en"},
    )
    assert response.status_code in (200, 201)
    return response.json()["id"]


SOURCE = "astrapi69/adaptive-learner-content"


def _post_step(
    client: TestClient,
    user_id: str,
    lesson: str,
    *,
    correct: int = 4,
    total: int = 4,
) -> None:
    r = client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": "language-fr-a1",
            "lesson_filename": lesson,
            "step_result": {
                "step_id": "ex-1",
                "correct": correct,
                "total": total,
            },
        },
    )
    assert r.status_code == 200, r.text


def _post_complete(client: TestClient, user_id: str, lesson: str) -> None:
    r = client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": SOURCE,
            "set_id": "language-fr-a1",
            "lesson_filename": lesson,
            "mark_completed": True,
        },
    )
    assert r.status_code == 200, r.text


def _badge(client: TestClient, user_id: str, key: str) -> dict:
    body = client.get(f"/api/plugins/gamification/badges/{user_id}").json()
    return next(b for b in body if b["key"] == key)


# --- first_lesson ---------------------------------------------------------


def test_first_lesson_badge_lands_on_lesson_completion(
    client: TestClient,
) -> None:
    user_id = _make_user(client, "first-lesson-A")
    _post_step(client, user_id, "lesson-01.json")
    _post_complete(client, user_id, "lesson-01.json")

    badge = _badge(client, user_id, "first_lesson")
    assert badge["earned"] is True
    assert badge["earned_at"] is not None


def test_first_lesson_badge_not_earned_without_completion(
    client: TestClient,
) -> None:
    user_id = _make_user(client, "first-lesson-B")
    _post_step(client, user_id, "lesson-01.json")
    # No mark_completed — only step progress.

    badge = _badge(client, user_id, "first_lesson")
    assert badge["earned"] is False


# --- lessons_10 -----------------------------------------------------------


def test_lessons_10_not_earned_before_threshold(client: TestClient) -> None:
    user_id = _make_user(client, "lessons-10-A")
    for i in range(9):
        lesson = f"lesson-{i:02d}.json"
        _post_step(client, user_id, lesson)
        _post_complete(client, user_id, lesson)

    badge = _badge(client, user_id, "lessons_10")
    assert badge["earned"] is False
    # And first_lesson is earned by virtue of the first completion.
    assert _badge(client, user_id, "first_lesson")["earned"] is True


def test_lessons_10_earned_at_tenth_completion(client: TestClient) -> None:
    user_id = _make_user(client, "lessons-10-B")
    for i in range(10):
        lesson = f"lesson-{i:02d}.json"
        _post_step(client, user_id, lesson)
        _post_complete(client, user_id, lesson)

    badge = _badge(client, user_id, "lessons_10")
    assert badge["earned"] is True


# --- three_star_streak ----------------------------------------------------


def test_three_star_streak_after_three_perfect_lessons(
    client: TestClient,
) -> None:
    """3 lessons in a row at 100% (>= 90% band) earns the badge."""
    user_id = _make_user(client, "3star-A")
    for i in range(3):
        lesson = f"lesson-{i:02d}.json"
        _post_step(client, user_id, lesson, correct=4, total=4)
        _post_complete(client, user_id, lesson)

    badge = _badge(client, user_id, "three_star_streak")
    assert badge["earned"] is True


def test_three_star_streak_breaks_on_two_star_intermediate(
    client: TestClient,
) -> None:
    """Three completions but one was only 2 stars — NOT earned.

    Lesson 01 perfect (3*), lesson 02 at 3/4 = 75% (2*),
    lesson 03 perfect. The most-recent-3 window contains
    the 2-star lesson, so three_star_streak stays locked.
    """
    user_id = _make_user(client, "3star-B")
    _post_step(client, user_id, "lesson-01.json", correct=4, total=4)
    _post_complete(client, user_id, "lesson-01.json")
    _post_step(client, user_id, "lesson-02.json", correct=3, total=4)
    _post_complete(client, user_id, "lesson-02.json")
    _post_step(client, user_id, "lesson-03.json", correct=4, total=4)
    _post_complete(client, user_id, "lesson-03.json")

    badge = _badge(client, user_id, "three_star_streak")
    assert badge["earned"] is False


def test_three_star_streak_not_earned_with_fewer_than_three(
    client: TestClient,
) -> None:
    user_id = _make_user(client, "3star-C")
    for i in range(2):
        lesson = f"lesson-{i:02d}.json"
        _post_step(client, user_id, lesson, correct=4, total=4)
        _post_complete(client, user_id, lesson)

    badge = _badge(client, user_id, "three_star_streak")
    assert badge["earned"] is False


# --- review_master (50 mastered elements) ---------------------------------


def _seed_mastered_elements(user_id: str, count: int) -> None:
    """Direct-DB seed: insert ``count`` ElementError rows with
    ``mastered=True`` for the user. Sidesteps the 50-attempt
    grind that would be required end-to-end."""
    db = SessionLocal()
    try:
        now = datetime.now(UTC)
        for i in range(count):
            db.add(
                ElementError(
                    user_id=user_id,
                    set_id="seed-set",
                    lesson_id="seed-lesson",
                    exercise_id=f"ex-{i:03d}",
                    element_key=f"elem-{i:03d}",
                    element_type="vocabulary",
                    user_answer="",
                    correct_answer="",
                    error_count=3,
                    correct_streak=3,
                    last_error_at=now - timedelta(days=2),
                    last_attempt_at=now,
                    mastered=True,
                    mastered_at=now,
                    created_at=now,
                    updated_at=now,
                )
            )
        db.commit()
    finally:
        db.close()


def _force_evaluate(client: TestClient, user_id: str) -> list[str]:
    r = client.post(f"/api/plugins/gamification/badges/{user_id}/evaluate")
    assert r.status_code == 200
    body = r.json()
    return body.get("earned", [])


def test_review_master_not_earned_below_fifty(client: TestClient) -> None:
    user_id = _make_user(client, "rm-A")
    _seed_mastered_elements(user_id, count=49)
    _force_evaluate(client, user_id)

    badge = _badge(client, user_id, "review_master")
    assert badge["earned"] is False


def test_review_master_earned_at_fifty_mastered_elements(
    client: TestClient,
) -> None:
    user_id = _make_user(client, "rm-B")
    _seed_mastered_elements(user_id, count=50)
    _force_evaluate(client, user_id)

    badge = _badge(client, user_id, "review_master")
    assert badge["earned"] is True


def test_review_master_isolated_per_user(client: TestClient) -> None:
    """User A has 50 mastered; user B has 0. Only A earns."""
    user_a = _make_user(client, "rm-iso-A")
    user_b = _make_user(client, "rm-iso-B")
    _seed_mastered_elements(user_a, count=50)
    _force_evaluate(client, user_a)
    _force_evaluate(client, user_b)

    assert _badge(client, user_a, "review_master")["earned"] is True
    assert _badge(client, user_b, "review_master")["earned"] is False


# --- Tier upgrades (Phase 57 / v1.40.0) -----------------------------------


def _seed_mastered_range(user_id: str, start: int, stop: int) -> None:
    """Insert mastered ElementError rows with indices [start, stop) so
    cumulative seeding doesn't collide on the element key."""
    db = SessionLocal()
    try:
        now = datetime.now(UTC)
        for i in range(start, stop):
            db.add(
                ElementError(
                    user_id=user_id,
                    set_id="seed-set",
                    lesson_id="seed-lesson",
                    exercise_id=f"ex-{i:04d}",
                    element_key=f"elem-{i:04d}",
                    element_type="vocabulary",
                    user_answer="",
                    correct_answer="",
                    error_count=3,
                    correct_streak=3,
                    last_error_at=now - timedelta(days=2),
                    last_attempt_at=now,
                    mastered=True,
                    mastered_at=now,
                    created_at=now,
                    updated_at=now,
                )
            )
        db.commit()
    finally:
        db.close()


def _evaluate_full(client: TestClient, user_id: str) -> dict:
    r = client.post(f"/api/plugins/gamification/badges/{user_id}/evaluate")
    assert r.status_code == 200, r.text
    return r.json()


def _review_upgrade(body: dict) -> dict | None:
    for up in body["upgrades"]:
        if up["key"] == "review_master":
            return up
    return None


def _xp_total(client: TestClient, user_id: str) -> int:
    return client.get(f"/api/plugins/gamification/xp/{user_id}").json()["total_xp"]


def test_review_master_tier_climbs_and_awards_xp_delta(
    client: TestClient,
) -> None:
    """review_master (dynamic: 50/200/500) climbs bronze->silver->gold
    as mastery grows, awarding the cumulative-total DELTA on each step,
    and never re-awards once a tier is held (Q-122 / high-water mark)."""
    user_id = _make_user(client, "rm-tier")

    # 50 mastered -> first earn at bronze, +50 XP.
    _seed_mastered_range(user_id, 0, 50)
    body = _evaluate_full(client, user_id)
    assert "review_master" in body["earned"]
    up = _review_upgrade(body)
    assert up == {
        "key": "review_master",
        "old_tier": None,
        "new_tier": "bronze",
        "xp_awarded": 50,
    }
    assert _xp_total(client, user_id) == 50

    # 200 mastered -> upgrade to silver, delta +100 (150 - 50).
    _seed_mastered_range(user_id, 50, 200)
    body = _evaluate_full(client, user_id)
    up = _review_upgrade(body)
    assert up is not None
    assert up["old_tier"] == "bronze" and up["new_tier"] == "silver"
    assert up["xp_awarded"] == 100
    assert _xp_total(client, user_id) == 150
    # Not a NEW earn — only an upgrade.
    assert "review_master" not in body["earned"]

    # 500 mastered -> upgrade to gold, delta +150 (300 - 150).
    _seed_mastered_range(user_id, 200, 500)
    body = _evaluate_full(client, user_id)
    up = _review_upgrade(body)
    assert up is not None
    assert up["new_tier"] == "gold" and up["xp_awarded"] == 150
    assert _xp_total(client, user_id) == 300

    # Re-evaluate at gold -> no further upgrade, no further XP.
    body = _evaluate_full(client, user_id)
    assert _review_upgrade(body) is None
    assert _xp_total(client, user_id) == 300
    assert _badge(client, user_id, "review_master")["tier"] == "gold"
