"""FastAPI routes for the gamification plugin (Phase 29).

  GET  /api/plugins/gamification/xp/{user_id}                -> XP state
  POST /api/plugins/gamification/xp/{user_id}/award          -> manual award
  POST /api/plugins/gamification/xp/{user_id}/award-assessment
  POST /api/plugins/gamification/xp/{user_id}/award-import

The award-assessment and award-import endpoints are flat-XP earn
points that the assessment + import flows call after the
respective action succeeds. Kept in the plugin (not core) so the
core stays gamification-agnostic.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError
from app.models import User

from . import badge_service, streak_service, xp_service

router = APIRouter(prefix="/plugins/gamification", tags=["gamification"])


def _ensure_user(db: Session, user_id: str) -> None:
    if db.get(User, user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")


class _ManualAwardBody(BaseModel):
    amount: int = Field(ge=-100_000, le=100_000)
    reason: str = Field(min_length=1, max_length=100)


@router.get("/xp/{user_id}")
def get_xp_state(user_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    _ensure_user(db, user_id)
    return xp_service.get_user_xp_state(db, user_id)


@router.post("/xp/{user_id}/award-assessment")
def award_assessment(user_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Award 100 XP for completing the assessment.

    Idempotent at the spec level (re-completing the assessment
    counts as a new completion and earns again — same as Duolingo's
    placement-retake). The frontend gates the earn-call so
    repeated calls require an intentional re-assessment.
    """
    _ensure_user(db, user_id)
    award = xp_service.award_xp_flat(
        db, user_id=user_id, amount=100, reason="assessment_complete"
    )
    # Re-evaluate badges (first_assessment + any level-up triggers).
    badge_service.evaluate_user(db, user_id)
    return award.to_dict()


@router.post("/xp/{user_id}/award-import")
def award_import(user_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Award 75 XP for importing + analyzing a conversation."""
    _ensure_user(db, user_id)
    award = xp_service.award_xp_flat(
        db, user_id=user_id, amount=75, reason="conversation_imported"
    )
    badge_service.evaluate_user(db, user_id)
    return award.to_dict()


# --- Badges (Phase 29B) ----------------------------------------------------


@router.get("/badges/{user_id}")
def list_user_badges(
    user_id: str, db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    """Catalog + per-user earn state for the dashboard showcase.

    Returns every catalog badge with ``earned``/``earned_at``
    so the showcase can grey out locked ones and show earn dates
    next to unlocked ones in a single roundtrip.
    """
    _ensure_user(db, user_id)
    return badge_service.list_badges_with_progress(db, user_id)


@router.get("/badges")
def list_badge_catalog(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Public catalog — no user context. For the marketing surface
    and Settings preview."""
    from app.models import Badge

    rows = (
        db.query(Badge).order_by(Badge.category.asc(), Badge.key.asc()).all()
    )
    return [
        {
            "key": r.key,
            "name_key": r.name_key,
            "description_key": r.description_key,
            "icon": r.icon,
            "category": r.category,
        }
        for r in rows
    ]


@router.post("/badges/{user_id}/evaluate")
def trigger_badge_evaluation(
    user_id: str, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Force a badge re-evaluation. Used by Settings + the import +
    assessment flows when a non-session action might unlock a
    badge (e.g. "Three providers configured")."""
    _ensure_user(db, user_id)
    earned = badge_service.evaluate_user(db, user_id)
    return {"earned": earned}


# --- Streaks (Phase 29C) ---------------------------------------------------


class _WeekendModeBody(BaseModel):
    enabled: bool


@router.get("/streak/{user_id}")
def get_streak(user_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Per-user streak state: current/longest counts + freeze
    inventory + weekend-mode flag. Recomputes the current count
    on read so the dashboard never shows stale data."""
    _ensure_user(db, user_id)
    streak_service.update_streak_state(db, user_id)
    return streak_service.get_streak_state(db, user_id)


@router.get("/streak/{user_id}/heatmap")
def get_streak_heatmap(
    user_id: str, days: int = 365, db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    """52-week-by-default activity heatmap for the calendar
    component. ``days`` clamps to [7, 730]."""
    _ensure_user(db, user_id)
    days = max(7, min(730, days))
    return streak_service.calendar_heatmap(db, user_id, days=days)


@router.post("/streak/{user_id}/weekend-mode")
def set_weekend_mode(
    user_id: str,
    body: _WeekendModeBody,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Toggle weekend mode: weekends don't break the streak."""
    _ensure_user(db, user_id)
    return streak_service.set_weekend_mode(db, user_id, body.enabled)


# --- Reset (Phase 29D) ----------------------------------------------------


@router.post("/reset/{user_id}")
def reset_progress(
    user_id: str, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Destructive reset of XP / badges / streak state for one user.

    Wipes ``user_xp``, ``user_badges``, ``user_streaks`` rows; the
    badge catalog (``badges``) is shared + survives. The frontend
    gates the call behind a double confirmation.

    Returns ``{xp_deleted, badges_deleted, streak_deleted}`` counts
    for the success toast.
    """
    from app.models import UserBadge, UserStreak, UserXP

    _ensure_user(db, user_id)
    xp_deleted = (
        db.query(UserXP).filter(UserXP.user_id == user_id).delete()
    )
    badges_deleted = (
        db.query(UserBadge).filter(UserBadge.user_id == user_id).delete()
    )
    streak_deleted = (
        db.query(UserStreak).filter(UserStreak.user_id == user_id).delete()
    )
    db.commit()
    return {
        "xp_deleted": int(xp_deleted),
        "badges_deleted": int(badges_deleted),
        "streak_deleted": int(streak_deleted),
    }


@router.post("/xp/{user_id}/award")
def manual_award(
    user_id: str,
    body: _ManualAwardBody,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Manual XP grant — admin / test entry point.

    Exposed publicly because there is no auth layer in this
    project (single-user desktop install). Negative amounts are
    permitted so the Settings "Reset XP" button has an API path.
    """
    _ensure_user(db, user_id)
    award = xp_service.award_xp_flat(
        db, user_id=user_id, amount=body.amount, reason=body.reason
    )
    return award.to_dict()
