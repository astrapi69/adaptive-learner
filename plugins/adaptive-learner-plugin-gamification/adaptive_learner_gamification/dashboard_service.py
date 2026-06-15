"""Aggregation logic for the gamification dashboard endpoints (#572).

Composes the dashboard read-models from the existing gamification
services (XP calculators, streak state + heatmap, badge catalog +
progress) plus :mod:`dashboard_repository`. Pure of FastAPI — the
router is the only HTTP-aware layer.

XP history note: there is no per-event XP ledger (``UserXP`` is a
running total), so daily XP is *derived* from dated lesson completions
via :func:`xp_service.calculate_lesson_session_xp` with a neutral
streak multiplier (the historical streak per day is not reconstructable).
It is an activity-derived trend, not an audited ledger; the authoritative
lifetime total is ``summary.xp.total_xp`` from ``UserXP``.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import TYPE_CHECKING, Any

from . import badge_service, dashboard_repository, streak_service, xp_service

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

XP_HISTORY_DAYS = 30
STREAK_CALENDAR_DAYS = 90


def xp_history(db: Session, user_id: str, *, days: int = XP_HISTORY_DAYS) -> list[dict[str, Any]]:
    """Per-day XP for the last ``days`` days as ``[{date, xp_earned, total_xp}]``.

    Daily XP is the sum of lesson-completion XP earned that day; the
    series is backfilled so every day in the window appears, and
    ``total_xp`` is the running cumulative across the window.
    """
    today = datetime.now(UTC).date()
    start = today - timedelta(days=days - 1)
    since = datetime.combine(start, datetime.min.time(), tzinfo=UTC)

    per_day: dict[date, int] = defaultdict(int)
    for lesson in dashboard_repository.completed_lessons_since(db, user_id, since):
        if lesson.completed_at is None:
            continue
        stars = xp_service.compute_stars(lesson.score_correct, lesson.score_total)
        first_attempt = xp_service.is_first_attempt_from_step_results(lesson.step_results)
        award = xp_service.calculate_lesson_session_xp(
            stars=stars, first_attempt=first_attempt, streak_days=0
        )
        per_day[lesson.completed_at.date()] += award.xp_earned

    out: list[dict[str, Any]] = []
    running = 0
    cursor = start
    while cursor <= today:
        earned = per_day.get(cursor, 0)
        running += earned
        out.append(
            {"date": cursor.isoformat(), "xp_earned": earned, "total_xp": running}
        )
        cursor += timedelta(days=1)
    return out


def streak(db: Session, user_id: str, *, days: int = STREAK_CALENDAR_DAYS) -> dict[str, Any]:
    """Current + longest streak and the active learning days (last ``days``)."""
    streak_service.update_streak_state(db, user_id)
    state = streak_service.get_streak_state(db, user_id)
    start = datetime.now(UTC).date() - timedelta(days=days - 1)
    active = dashboard_repository.active_learning_days_since(db, user_id, start)
    return {
        "current": int(state["current_streak_days"] or 0),
        "longest": int(state["longest_streak_days"] or 0),
        "activeDays": sorted(d.isoformat() for d in active),
    }


def badges(db: Session, user_id: str) -> list[dict[str, Any]]:
    """Every catalog badge with earn-state + ``{current, required}`` progress.

    ``name`` / ``description`` are i18n keys (the catalog stores keys, not
    localized strings); the caller resolves them.
    """
    catalog = badge_service.list_badges_with_progress(db, user_id)
    progress = badge_service.badge_progress_map(db, user_id)
    return [
        {
            "id": badge["key"],
            "name": badge["name_key"],
            "description": badge["description_key"],
            "earned": badge["earned"],
            "earned_at": badge["earned_at"],
            "progress": progress.get(badge["key"]),
        }
        for badge in catalog
    ]


def summary(db: Session, user_id: str) -> dict[str, Any]:
    """All three widgets plus the headline XP total, in one round-trip."""
    xp_state = xp_service.get_user_xp_state(db, user_id)
    return {
        "xp": {
            "total_xp": int(xp_state.get("total_xp", 0)),
            "level": int(xp_state.get("level", 1)),
        },
        "xp_history": xp_history(db, user_id),
        "streak": streak(db, user_id),
        "badges": badges(db, user_id),
    }
