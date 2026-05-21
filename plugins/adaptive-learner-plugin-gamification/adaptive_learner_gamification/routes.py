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

from . import xp_service

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
    return award.to_dict()


@router.post("/xp/{user_id}/award-import")
def award_import(user_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Award 75 XP for importing + analyzing a conversation."""
    _ensure_user(db, user_id)
    award = xp_service.award_xp_flat(
        db, user_id=user_id, amount=75, reason="conversation_imported"
    )
    return award.to_dict()


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
