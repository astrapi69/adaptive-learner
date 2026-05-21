"""Enhanced streak state (Phase 29C / v1.16.0).

The basic streak counter — consecutive activity days ending
today — lives in ``xp_service.current_streak_days``. This module
adds the persistent state that the basic counter can't carry:

- **Streak freezes**: a freeze pauses (not resets) the streak
  when the user misses a day. One freeze is earned per 7 days of
  streak; up to 3 stockpiled at once. The user spends a freeze
  automatically when activity skips a day.

- **Weekend mode**: optional toggle that excludes Saturday +
  Sunday from streak gap detection. A user who practices
  Monday-Friday and skips weekends keeps their streak.

- **Cached longest_streak_days**: the basic counter is "current
  only"; this snapshot lets the dashboard show "longest streak"
  without a full session-table scan.

The active streak shown in the UI is the OUTPUT of
``compute_current_streak_with_state``: the basic counter +
freeze/weekend-mode adjustments.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


# How many days of streak earn a new freeze. The spec says
# "1 freeze per 7 days of streak"; the implementation grants
# one freeze every 7 unique streak days (no double-grant in
# the same 7-day window even if the user spends one mid-window).
_FREEZE_GRANT_INTERVAL_DAYS = 7
_FREEZE_STOCK_CAP = 3


def _is_weekend(d: date) -> bool:
    # Monday=0 .. Sunday=6. Sat=5, Sun=6.
    return d.weekday() >= 5


def get_or_create_user_streak(db: Session, user_id: str):
    """Singleton getter — creates a zero-state row on first call."""
    from app.models import UserStreak

    row = db.query(UserStreak).filter(UserStreak.user_id == user_id).first()
    if row is None:
        row = UserStreak(
            user_id=user_id,
            freezes_available=0,
            weekend_mode=False,
            current_streak_days=0,
            longest_streak_days=0,
        )
        db.add(row)
        db.flush()
    return row


def compute_current_streak_with_state(
    activity_dates: set[date],
    today: date,
    *,
    weekend_mode: bool,
    freezes_available: int,
) -> tuple[int, int]:
    """Count consecutive days ending today, honoring weekend
    mode + freezes.

    Returns ``(streak_days, freezes_consumed)``. ``streak_days`` is
    0 if today has no activity AND no freezes consume the gap.
    Freezes are spent in order, oldest-first; once exhausted the
    walk stops.

    Weekend rule: when ``weekend_mode`` is True, weekend days
    don't break the streak. The streak still ONLY advances on
    activity days, but a Saturday with no activity doesn't reset.
    """
    if today not in activity_dates and not weekend_mode and freezes_available <= 0:
        return (0, 0)

    streak = 0
    freezes_used = 0
    cursor = today

    while True:
        if cursor in activity_dates:
            streak += 1
            cursor -= timedelta(days=1)
            continue
        if weekend_mode and _is_weekend(cursor):
            cursor -= timedelta(days=1)
            continue
        # Gap day; try to spend a freeze.
        if freezes_used < freezes_available:
            freezes_used += 1
            cursor -= timedelta(days=1)
            continue
        break

    return (streak, freezes_used)


def update_streak_state(db: Session, user_id: str) -> dict[str, int | bool]:
    """Recompute the user's current+longest streak, persist into
    ``user_streaks``, and grant any earned freezes.

    Called from the session-complete + assessment + import earn
    hooks. Returns the post-update state dict (current,
    longest, freezes_available).
    """
    from . import xp_service

    row = get_or_create_user_streak(db, user_id)
    activity = xp_service._activity_dates_for_user(db, user_id)
    today = datetime.now(UTC).date()
    streak, freezes_used = compute_current_streak_with_state(
        activity,
        today,
        weekend_mode=row.weekend_mode,
        freezes_available=row.freezes_available,
    )

    # Spend freezes that the new walk consumed (idempotent: the
    # walk re-derives from the persisted ``freezes_available``
    # each call, so we ONLY subtract when the spending changes
    # the value).
    if freezes_used > 0:
        # Persisted as "last_freeze_used_on" — we don't track
        # per-freeze consumption history; one date is enough.
        row.last_freeze_used_on = datetime.now(UTC)
        row.freezes_available = max(0, row.freezes_available - freezes_used)

    # Grant a freeze every _FREEZE_GRANT_INTERVAL_DAYS of streak,
    # capped at _FREEZE_STOCK_CAP.
    if streak > 0 and streak % _FREEZE_GRANT_INTERVAL_DAYS == 0:
        last_grant = row.last_freeze_earned_on
        # Don't double-grant within a 7-day window.
        if (
            last_grant is None
            or (datetime.now(UTC) - last_grant) >= timedelta(days=6)
        ):
            if row.freezes_available < _FREEZE_STOCK_CAP:
                row.freezes_available = row.freezes_available + 1
                row.last_freeze_earned_on = datetime.now(UTC)

    row.current_streak_days = streak
    if streak > row.longest_streak_days:
        row.longest_streak_days = streak
    db.commit()
    db.refresh(row)

    return {
        "current_streak_days": row.current_streak_days,
        "longest_streak_days": row.longest_streak_days,
        "freezes_available": row.freezes_available,
        "weekend_mode": row.weekend_mode,
    }


def get_streak_state(db: Session, user_id: str) -> dict[str, int | bool | None]:
    """Read-only state for the dashboard widget + Settings."""
    row = get_or_create_user_streak(db, user_id)
    return {
        "user_id": user_id,
        "current_streak_days": row.current_streak_days,
        "longest_streak_days": row.longest_streak_days,
        "freezes_available": row.freezes_available,
        "weekend_mode": row.weekend_mode,
        "last_freeze_earned_on": (
            row.last_freeze_earned_on.isoformat() if row.last_freeze_earned_on else None
        ),
        "last_freeze_used_on": (
            row.last_freeze_used_on.isoformat() if row.last_freeze_used_on else None
        ),
    }


def set_weekend_mode(db: Session, user_id: str, enabled: bool) -> dict:
    """Settings-driven toggle."""
    row = get_or_create_user_streak(db, user_id)
    row.weekend_mode = bool(enabled)
    db.commit()
    db.refresh(row)
    return get_streak_state(db, user_id)


def calendar_heatmap(
    db: Session, user_id: str, *, days: int = 365
) -> list[dict[str, int | str]]:
    """Return ``[{date, count}]`` for the last ``days`` calendar days.

    ``count`` is the number of sessions started on that day (NOT
    "completed only" — engagement matters for the heatmap, not
    completion). Backfills missing days with ``count=0`` so the
    frontend can render a contiguous grid.
    """
    from app.models import LearningProject, LearningSession

    today = datetime.now(UTC).date()
    start = today - timedelta(days=days - 1)
    rows = (
        db.query(LearningSession.started_at)
        .join(LearningProject, LearningSession.project_id == LearningProject.id)
        .filter(LearningProject.user_id == user_id)
        .all()
    )
    counts: dict[date, int] = {}
    for (started_at,) in rows:
        if started_at is None:
            continue
        d = started_at.date()
        if d < start or d > today:
            continue
        counts[d] = counts.get(d, 0) + 1
    out: list[dict[str, int | str]] = []
    cursor = start
    while cursor <= today:
        out.append({"date": cursor.isoformat(), "count": counts.get(cursor, 0)})
        cursor += timedelta(days=1)
    return out
