"""ElementSRS service unit tests (Phase 46C / C11 / P-129).

Pins:
- interval_days_for_streak band mapping
- compute_review_queue excludes mastered elements
- compute_review_queue sets suggested_review_at = last + interval
- compute_review_queue computes overdue against an injected clock
- Sort order: overdue first → error_count desc → last_error_at desc
- set_id filter works
- Empty input returns []
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.schemas import ElementAttemptIn
from app.services import element_errors as element_errors_service
from app.services.element_srs import (
    ReviewQueueItem,
    compute_review_queue,
    interval_days_for_streak,
)


@pytest.fixture()
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def user_id(client: TestClient) -> str:
    r = client.post(
        "/api/users", json={"name": "SRSTest", "language": "en"},
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _attempt(
    *,
    set_id: str = "language-fr-a1",
    lesson_id: str = "01-greetings.json",
    exercise_id: str = "ex-thanks",
    element_key: str = "merci",
    correct: bool,
) -> ElementAttemptIn:
    return ElementAttemptIn(
        set_id=set_id,
        lesson_id=lesson_id,
        exercise_id=exercise_id,
        element_key=element_key,
        element_type="vocabulary",
        user_answer="",
        correct_answer="Merci",
        correct=correct,
    )


# --- interval_days_for_streak ----------------------------------------------


def test_interval_streak_0_is_1_day() -> None:
    assert interval_days_for_streak(0) == 1


def test_interval_streak_1_is_3_days() -> None:
    assert interval_days_for_streak(1) == 3


def test_interval_streak_2_is_7_days() -> None:
    assert interval_days_for_streak(2) == 7


def test_interval_streak_above_2_caps_at_7_days() -> None:
    # Mastered elements shouldn't reach this fn (filtered
    # upstream); 7 is a safe fallback if the filter slips.
    assert interval_days_for_streak(3) == 7
    assert interval_days_for_streak(10) == 7


def test_interval_negative_streak_defensive_returns_1() -> None:
    assert interval_days_for_streak(-1) == 1


# --- compute_review_queue --------------------------------------------------


def test_empty_user_returns_empty_queue(user_id: str) -> None:
    db = SessionLocal()
    try:
        assert compute_review_queue(db, user_id) == []
    finally:
        db.close()


def test_mastered_elements_excluded(user_id: str) -> None:
    """3 consecutive corrects → mastered → excluded from queue."""
    db = SessionLocal()
    try:
        for _ in range(3):
            element_errors_service.record_attempt(
                db, user_id, _attempt(correct=True),
            )
        db.commit()
        assert compute_review_queue(db, user_id) == []
    finally:
        db.close()


def test_active_element_appears_in_queue(user_id: str) -> None:
    db = SessionLocal()
    try:
        element_errors_service.record_attempt(
            db, user_id, _attempt(correct=False),
        )
        db.commit()
        queue = compute_review_queue(db, user_id)
        assert len(queue) == 1
        assert queue[0].element_key == "merci"
        assert queue[0].correct_streak == 0
        assert queue[0].error_count == 1
    finally:
        db.close()


def test_suggested_review_is_last_attempt_plus_interval(
    user_id: str,
) -> None:
    db = SessionLocal()
    try:
        row = element_errors_service.record_attempt(
            db, user_id, _attempt(correct=False),
        )
        db.commit()
        queue = compute_review_queue(db, user_id)
        item = queue[0]
        last = item.last_attempt_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=UTC)
        # streak=0 → 1 day band
        expected = last + timedelta(days=1)
        # Compare in microseconds — both sides have the same
        # source timestamp so the diff should be zero.
        delta = abs((item.suggested_review_at - expected).total_seconds())
        assert delta < 1
        # Sanity: row should also surface (id parity).
        assert item.id == row.id
    finally:
        db.close()


def test_overdue_flag_against_injected_clock(user_id: str) -> None:
    db = SessionLocal()
    try:
        element_errors_service.record_attempt(
            db, user_id, _attempt(correct=False),
        )
        db.commit()
        # Inject a clock 2 days in the future — the 1-day
        # suggested-review must be overdue.
        future = datetime.now(UTC) + timedelta(days=2)
        queue = compute_review_queue(db, user_id, now=future)
        assert queue[0].overdue is True
        # Inject a clock 1 second in the past — must be NOT overdue.
        present = datetime.now(UTC)
        queue_now = compute_review_queue(db, user_id, now=present)
        assert queue_now[0].overdue is False
    finally:
        db.close()


# --- Sort order ------------------------------------------------------------


def test_overdue_items_come_before_non_overdue(user_id: str) -> None:
    db = SessionLocal()
    try:
        element_errors_service.record_attempt(
            db, user_id, _attempt(element_key="overdue-one", correct=False),
        )
        element_errors_service.record_attempt(
            db, user_id, _attempt(element_key="fresh-one", correct=False),
        )
        db.commit()
        # Inject a clock that makes the FIRST element overdue
        # (>1d ago) but leaves the second within its interval.
        # Both have last_attempt_at near "now"; nudge the first
        # via direct DB update.
        from sqlalchemy import select

        from app.models import ElementError

        row = db.execute(
            select(ElementError).where(
                ElementError.element_key == "overdue-one",
            ),
        ).scalar_one()
        row.last_attempt_at = datetime.now(UTC) - timedelta(days=10)
        db.commit()

        queue = compute_review_queue(db, user_id)
        assert queue[0].element_key == "overdue-one"
        assert queue[0].overdue is True
        assert queue[1].element_key == "fresh-one"
        assert queue[1].overdue is False
    finally:
        db.close()


def test_higher_error_count_wins_among_overdue(user_id: str) -> None:
    db = SessionLocal()
    try:
        # 'high' gets 3 errors; 'low' gets 1.
        for _ in range(3):
            element_errors_service.record_attempt(
                db, user_id, _attempt(element_key="high", correct=False),
            )
        element_errors_service.record_attempt(
            db, user_id, _attempt(element_key="low", correct=False),
        )
        db.commit()
        # Push both into the overdue bucket.
        from app.models import ElementError

        for row in db.query(ElementError).all():
            row.last_attempt_at = datetime.now(UTC) - timedelta(days=10)
        db.commit()
        queue = compute_review_queue(db, user_id)
        assert queue[0].element_key == "high"
        assert queue[0].error_count == 3
        assert queue[1].element_key == "low"
        assert queue[1].error_count == 1
    finally:
        db.close()


# --- set_id filter ---------------------------------------------------------


def test_set_id_filter_scopes_the_queue(user_id: str) -> None:
    db = SessionLocal()
    try:
        element_errors_service.record_attempt(
            db, user_id, _attempt(set_id="set-a", correct=False),
        )
        element_errors_service.record_attempt(
            db, user_id, _attempt(set_id="set-b", correct=False),
        )
        db.commit()
        a_queue = compute_review_queue(db, user_id, set_id="set-a")
        assert len(a_queue) == 1
        assert a_queue[0].set_id == "set-a"
    finally:
        db.close()


def test_returned_items_are_review_queue_items(user_id: str) -> None:
    """Pins the dataclass shape so consumers can trust the
    fields land in the wire schema."""
    db = SessionLocal()
    try:
        element_errors_service.record_attempt(
            db, user_id, _attempt(correct=False),
        )
        db.commit()
        queue = compute_review_queue(db, user_id)
        assert isinstance(queue[0], ReviewQueueItem)
        for fld in (
            "id",
            "user_id",
            "set_id",
            "lesson_id",
            "exercise_id",
            "element_key",
            "element_type",
            "user_answer",
            "correct_answer",
            "error_count",
            "correct_streak",
            "last_error_at",
            "last_attempt_at",
            "suggested_review_at",
            "overdue",
        ):
            assert hasattr(queue[0], fld), fld
    finally:
        db.close()
