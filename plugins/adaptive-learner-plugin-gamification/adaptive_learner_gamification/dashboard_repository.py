"""Data-access layer for the gamification dashboard endpoints (#572).

The Router -> Service -> Repository split keeps the raw SQLAlchemy
reads here, the aggregation logic in :mod:`dashboard_service`, and the
HTTP shell in :mod:`dashboard_routes`. Plugins still use a
``Session``-backed data layer directly (EXP-024 Phase 2 has not migrated
the plugin tree to the abstract repository base classes yet), so this is
a plain query module, not a ``SqlAlchemyRepository`` subclass.

All reads are user-scoped; the service validates the user exists before
calling in.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def user_exists(db: Session, user_id: str) -> bool:
    """Whether a user row exists (the endpoints 404 otherwise)."""
    from app.models import User

    return db.get(User, user_id) is not None


def completed_lessons_since(db: Session, user_id: str, since: datetime) -> list:
    """Completed ``LessonProgress`` rows on/after ``since``.

    Ordered by completion time. Each row carries the score + step
    results the XP calculator needs, so the service can value each
    day's lessons without a second round-trip.
    """
    from app.models import LessonProgress

    return (
        db.query(LessonProgress)
        .filter(
            LessonProgress.user_id == user_id,
            LessonProgress.status == "completed",
            LessonProgress.completed_at.isnot(None),
            LessonProgress.completed_at >= since,
        )
        .order_by(LessonProgress.completed_at.asc())
        .all()
    )


def active_learning_days_since(db: Session, user_id: str, start: date) -> set[date]:
    """Distinct calendar days on/after ``start`` the user learned on.

    "Learning" = a chat session started OR a content lesson started /
    completed, so content-only learners (no chat sessions) still light
    up the calendar. Returns a set of ``date`` for the caller to format.
    """
    from app.models import LearningProject, LearningSession, LessonProgress

    today = datetime.now(UTC).date()
    days: set[date] = set()

    session_rows = (
        db.query(LearningSession.started_at)
        .join(LearningProject, LearningSession.project_id == LearningProject.id)
        .filter(LearningProject.user_id == user_id)
        .all()
    )
    for (started_at,) in session_rows:
        if started_at is not None:
            _add_day(days, started_at.date(), start, today)

    lesson_rows = (
        db.query(LessonProgress.started_at, LessonProgress.completed_at)
        .filter(LessonProgress.user_id == user_id)
        .all()
    )
    for started_at, completed_at in lesson_rows:
        for stamp in (started_at, completed_at):
            if stamp is not None:
                _add_day(days, stamp.date(), start, today)

    return days


def _add_day(days: set[date], value: date, start: date, today: date) -> None:
    if start <= value <= today:
        days.add(value)
