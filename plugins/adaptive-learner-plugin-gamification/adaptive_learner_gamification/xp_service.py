"""XP calculation + persistence (Phase 29A).

Pure-function calculator plus a SQLAlchemy-backed
``award_xp_for_session`` / ``award_xp_flat`` pair that the plugin
class invokes from its hook + earn-point endpoints.

XP curve and bonuses come from the Phase 29A spec:

- **Session base:** 50 XP per completed session.
- **Cycle bonus:** +10 XP per completed cycle.
- **Seven-step bonus:** +25 XP per cycle that reached step 7.
- **First-time method bonus:** +50 XP the first time the user
  finishes a session in a method they haven't used before.
- **Daily streak multiplier:** +25% per consecutive day of activity,
  capped at 7 days (max +175%, i.e. 2.75x).
- **Assessment completion:** 100 XP flat (no multiplier — assessment
  isn't a session).
- **Conversation import + analysis:** 75 XP flat.

The level curve is exponential: thresholds ``[0, 100, 300, 600,
1000, 1500, 2100, ...]`` (each gap grows by 100). The closed form
is ``threshold(level n) = 50 * n * (n - 1)`` (Gauss sum scaled by
100); ``compute_level`` walks it iteratively for clarity since the
caller never has more than ~50 levels to consider in practice.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


# ---------------------------------------------------------------------------
# Level curve
# ---------------------------------------------------------------------------


def level_threshold(level: int) -> int:
    """Return the cumulative XP required to REACH the given level.

    Level 1 starts at 0 XP. Level 2 at 100. Level 3 at 300. Each
    gap grows by 100 (100, 200, 300, ...) — exponential in the
    "feels-faster-then-slower" sense the spec asks for.

    Closed form: ``threshold(n) = 50 * n * (n - 1)``. Hand-checked
    on level 1..5: 0, 100, 300, 600, 1000.
    """
    if level < 1:
        return 0
    return 50 * level * (level - 1)


def compute_level(total_xp: int) -> int:
    """Return the highest level the user has reached with this XP.

    Walks the threshold table from level 1 upwards until the next
    threshold exceeds ``total_xp``. Safe for any non-negative
    ``total_xp``; returns 1 for ``total_xp <= 0``.
    """
    if total_xp <= 0:
        return 1
    level = 1
    while level_threshold(level + 1) <= total_xp:
        level += 1
        if level > 1000:  # safety net — astronomically out of range
            break
    return level


# ---------------------------------------------------------------------------
# XP-award dataclass
# ---------------------------------------------------------------------------


@dataclass
class XPAward:
    """One XP-award event (ephemeral, not persisted).

    Returned by the calculator so the route layer can surface the
    breakdown to the frontend for the floating "+50 XP" animation.
    The persisted state is :class:`app.models.UserXP`.
    """

    xp_earned: int
    xp_total: int
    level: int
    level_up: bool = False
    multiplier: float = 1.0
    breakdown: dict[str, int] = field(default_factory=dict)
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "xp_earned": self.xp_earned,
            "xp_total": self.xp_total,
            "level": self.level,
            "level_up": self.level_up,
            "multiplier": self.multiplier,
            "breakdown": dict(self.breakdown),
            "reason": self.reason,
        }


# ---------------------------------------------------------------------------
# Streak helpers
# ---------------------------------------------------------------------------


def _activity_dates_for_user(db: Session, user_id: str) -> set[date]:
    """Return the calendar-date set of distinct activity days.

    Activity = a ``LearningSession.started_at`` whose project
    belongs to the user. We don't filter to completed sessions
    because the streak is about engagement, not completion (the
    XP bonus IS only earned on completion).
    """
    from app.models import LearningProject, LearningSession

    rows = (
        db.query(LearningSession.started_at)
        .join(LearningProject, LearningSession.project_id == LearningProject.id)
        .filter(LearningProject.user_id == user_id)
        .all()
    )
    return {row[0].date() for row in rows if row[0] is not None}


def current_streak_days(
    activity_dates: set[date],
    today: date | None = None,
) -> int:
    """Count consecutive calendar days ending today.

    Walks backwards from ``today`` while each day is in
    ``activity_dates``. Returns ``0`` if today has no activity.
    """
    today = today or datetime.now(UTC).date()
    if today not in activity_dates:
        return 0
    streak = 0
    cursor = today
    while cursor in activity_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


# ---------------------------------------------------------------------------
# Calculator (pure)
# ---------------------------------------------------------------------------


def calculate_session_xp(
    *,
    cycle_step: int,
    cycle_count: int,
    streak_days: int,
    is_first_method_session: bool,
) -> XPAward:
    """Compute the XP award for a completed session.

    All inputs are primitives so this function is trivially
    unit-testable without a DB. The persistence wrapper
    :func:`award_xp_for_session` resolves the DB-derived inputs
    (``streak_days``, ``is_first_method_session``) then calls this.
    """
    base = 50
    breakdown: dict[str, int] = {"base": base}

    # Per cycle bonus. ``cycle_count`` is at least 1 (the current
    # cycle) — but a 1-cycle session shouldn't reward as if the
    # user "completed N cycles". Reward the COMPLETED cycles only:
    # current cycle counts iff cycle_step reached 7.
    completed_cycles = max(0, cycle_count - 1)
    if cycle_step >= 7:
        completed_cycles += 1
    if completed_cycles > 0:
        cycle_bonus = 10 * completed_cycles
        breakdown["cycle_bonus"] = cycle_bonus

    # Seven-step bonus per completed cycle.
    if completed_cycles > 0:
        breakdown["seven_step_bonus"] = 25 * completed_cycles

    if is_first_method_session:
        breakdown["first_method_bonus"] = 50

    pre_multiplier = sum(breakdown.values())

    # Streak multiplier — +25% per day, capped at 7 days.
    capped_days = min(streak_days, 7)
    multiplier = 1.0 + 0.25 * capped_days
    xp_earned = int(round(pre_multiplier * multiplier))
    if streak_days > 0:
        breakdown["streak_multiplier_pct"] = int(round((multiplier - 1.0) * 100))

    return XPAward(
        xp_earned=xp_earned,
        xp_total=0,  # filled in by award_xp_for_session
        level=1,
        multiplier=multiplier,
        breakdown=breakdown,
        reason="session_complete",
    )


# ---------------------------------------------------------------------------
# Persistence wrappers
# ---------------------------------------------------------------------------


def _get_or_create_user_xp(db: Session, user_id: str):
    """Singleton getter — creates a zero row on first call."""
    from app.models import UserXP

    row = db.query(UserXP).filter(UserXP.user_id == user_id).first()
    if row is None:
        row = UserXP(user_id=user_id, total_xp=0, level=1)
        db.add(row)
        db.flush()
    return row


def _resolve_user_id_from_session(db: Session, session: dict[str, Any]) -> str | None:
    """Walk LearningSession -> LearningProject -> user_id.

    Returns ``None`` if either FK doesn't resolve; the hook caller
    treats that as "skip the award" and logs.
    """
    from app.models import LearningProject

    project_id = session.get("project_id")
    if not project_id:
        return None
    proj = db.get(LearningProject, project_id)
    return proj.user_id if proj is not None else None


def _is_first_session_for_method(
    db: Session, user_id: str, method: str, current_session_id: str | None
) -> bool:
    """Has the user finished a session in this method before today's?

    We count "completed" sessions only — an open session doesn't
    consume the first-time bonus.
    """
    from app.models import LearningProject, LearningSession

    q = (
        db.query(LearningSession.id)
        .join(LearningProject, LearningSession.project_id == LearningProject.id)
        .filter(LearningProject.user_id == user_id)
        .filter(LearningSession.method == method)
        .filter(LearningSession.status == "completed")
    )
    if current_session_id:
        q = q.filter(LearningSession.id != current_session_id)
    return q.first() is None


def award_xp_for_session(
    db: Session,
    *,
    session: dict[str, Any],
    rating: dict[str, Any] | None = None,  # noqa: ARG001 — kept for hook parity
) -> XPAward | None:
    """Persist XP for a completed session and return the award.

    Returns ``None`` if the session payload is incomplete (e.g.
    missing project_id). Errors propagate; the hook caller wraps.
    """
    from app.models import UserXP  # noqa: F401 — imported for side-effects

    user_id = _resolve_user_id_from_session(db, session)
    if user_id is None:
        return None
    method = session.get("method")
    if not method:
        return None

    activity = _activity_dates_for_user(db, user_id)
    streak = current_streak_days(activity)
    first_time = _is_first_session_for_method(
        db, user_id, method, session.get("id")
    )

    award = calculate_session_xp(
        cycle_step=int(session.get("cycle_step", 1) or 1),
        cycle_count=int(session.get("cycle_count", 1) or 1),
        streak_days=streak,
        is_first_method_session=first_time,
    )

    row = _get_or_create_user_xp(db, user_id)
    previous_level = row.level
    row.total_xp = int(row.total_xp) + award.xp_earned
    row.level = compute_level(row.total_xp)
    db.commit()
    db.refresh(row)

    award.xp_total = row.total_xp
    award.level = row.level
    award.level_up = row.level > previous_level
    return award


def award_xp_flat(
    db: Session,
    *,
    user_id: str,
    amount: int,
    reason: str,
) -> XPAward:
    """Award a fixed XP amount (assessment, import). No multiplier.

    Pure flat awards exist outside the daily-streak frame: the
    spec only attaches the multiplier to session completion. Flat
    awards still count toward level progression.
    """
    row = _get_or_create_user_xp(db, user_id)
    previous_level = row.level
    row.total_xp = int(row.total_xp) + int(amount)
    row.level = compute_level(row.total_xp)
    db.commit()
    db.refresh(row)
    return XPAward(
        xp_earned=int(amount),
        xp_total=row.total_xp,
        level=row.level,
        level_up=row.level > previous_level,
        multiplier=1.0,
        breakdown={"flat": int(amount)},
        reason=reason,
    )


def get_user_xp_state(db: Session, user_id: str) -> dict[str, Any]:
    """Read-only state for the dashboard XP widget."""
    from app.models import UserXP

    row = db.query(UserXP).filter(UserXP.user_id == user_id).first()
    if row is None:
        return {
            "user_id": user_id,
            "total_xp": 0,
            "level": 1,
            "xp_into_level": 0,
            "xp_to_next_level": level_threshold(2),
            "next_level_threshold": level_threshold(2),
        }
    current_threshold = level_threshold(row.level)
    next_threshold = level_threshold(row.level + 1)
    return {
        "user_id": user_id,
        "total_xp": row.total_xp,
        "level": row.level,
        "xp_into_level": row.total_xp - current_threshold,
        "xp_to_next_level": max(0, next_threshold - row.total_xp),
        "next_level_threshold": next_threshold,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
