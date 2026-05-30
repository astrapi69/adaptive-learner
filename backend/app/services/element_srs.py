"""Element-level review-queue computation (Phase 46C / C11 / P-129).

Reads ``element_errors`` rows for a user and projects them
into a prioritised review queue. The dashboard widget
(commit C13) reads the queue + the review session (commit
C14+ / sub-phase D) consumes it to synthesise a mini-lesson
from the top-N due elements.

Interval policy (Phase 46 plan):

    correct_streak  →  interval (days)
    ─────────────────────────────────────
    0  (latest attempt wrong)  →  1
    1                          →  3
    2                          →  7
    3+                         →  (mastered; excluded from queue)

The 14-day and 30-day bands the spec mentions are reserved
for a future mastery-relapse policy (Phase 47+): an element
that was once mastered then demoted re-enters at a longer
interval than a never-mastered element. v1 doesn't track
relapse history; mastered → wrong → streak=0 → 1-day band,
same as a brand-new error.

Priority order within the queue:

    1. overdue first (suggested_review_at <= now)
    2. then error_count desc (more errors = more urgent)
    3. then last_error_at desc (recent failures first)

Mastered elements are excluded via the service's
``list_for_user(..., include_mastered=False)`` filter; this
module just maps the active rows.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models import ElementError
from app.services import element_errors as element_errors_service


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _ensure_utc(dt: datetime) -> datetime:
    """SQLite ``DateTime(timezone=True)`` strips tzinfo on
    roundtrip. Re-stamp the value as UTC so timedelta
    arithmetic doesn't blow up on the naive-vs-aware mix."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


# Interval (days) keyed by correct_streak. v1 uses three
# bands; 14/30 are reserved for a future mastery-relapse
# track (see module docstring).
_INTERVAL_DAYS_BY_STREAK: dict[int, int] = {
    0: 1,
    1: 3,
    2: 7,
}


def interval_days_for_streak(correct_streak: int) -> int:
    """Map a correct-streak count to the next-review
    interval in days. Streaks of 3+ shouldn't reach this
    function (mastered elements are filtered upstream) but
    we return 7 as a safe upper bound rather than raising —
    the queue stays responsive even if the filter is wrong."""
    if correct_streak <= 0:
        return _INTERVAL_DAYS_BY_STREAK[0]
    if correct_streak >= 2:
        return _INTERVAL_DAYS_BY_STREAK[2]
    return _INTERVAL_DAYS_BY_STREAK[correct_streak]


@dataclass(frozen=True)
class ReviewQueueItem:
    """One row in the projected review queue.

    All ``ElementError`` fields plus the computed scheduling
    fields. The wire schema (``ReviewQueueItemOut`` in
    ``schemas/__init__.py``) mirrors this dataclass; the
    route layer projects ORM → dataclass → Pydantic.
    """

    id: str
    user_id: str
    set_id: str
    lesson_id: str
    exercise_id: str
    element_key: str
    direction: str
    element_type: str
    user_answer: str
    correct_answer: str
    error_count: int
    correct_streak: int
    last_error_at: datetime | None
    last_attempt_at: datetime
    suggested_review_at: datetime
    overdue: bool


def _project(row: ElementError, now: datetime) -> ReviewQueueItem:
    interval = interval_days_for_streak(row.correct_streak)
    last = _ensure_utc(row.last_attempt_at)
    suggested = last + timedelta(days=interval)
    return ReviewQueueItem(
        id=row.id,
        user_id=row.user_id,
        set_id=row.set_id,
        lesson_id=row.lesson_id,
        exercise_id=row.exercise_id,
        element_key=row.element_key,
        direction=row.direction,
        element_type=row.element_type,
        user_answer=row.user_answer,
        correct_answer=row.correct_answer,
        error_count=row.error_count,
        correct_streak=row.correct_streak,
        last_error_at=row.last_error_at,
        last_attempt_at=row.last_attempt_at,
        suggested_review_at=suggested,
        overdue=suggested <= now,
    )


def _sort_key(item: ReviewQueueItem) -> tuple[int, int, int]:
    """Sort: overdue first (0 beats 1), then error_count
    desc (negated), then last_error_at desc (negated via
    min-datetime fallback). Stable tie-break by id at the
    caller if needed."""
    overdue_bucket = 0 if item.overdue else 1
    last_err_for_sort = item.last_error_at or datetime.min.replace(
        tzinfo=UTC,
    )
    # tuples sort lexicographically — desc by negating ints,
    # desc by negating timestamp via subtraction from a
    # max-like sentinel. Simpler: use a sortable negative
    # delta as int (microseconds since epoch).
    last_err_us = int(
        _ensure_utc(last_err_for_sort).timestamp() * 1_000_000,
    )
    return (overdue_bucket, -item.error_count, -last_err_us)


def compute_review_queue(
    db: Session,
    user_id: str,
    *,
    set_id: str | None = None,
    now: datetime | None = None,
) -> list[ReviewQueueItem]:
    """Project active element-error rows into a prioritised
    review queue. Mastered elements are excluded.

    ``now`` is injectable for deterministic tests.
    """
    clock = now if now is not None else _utcnow()
    rows = element_errors_service.list_for_user(
        db,
        user_id,
        set_id=set_id,
        include_mastered=False,
    )
    items = [_project(row, clock) for row in rows]
    items.sort(key=_sort_key)
    return items
