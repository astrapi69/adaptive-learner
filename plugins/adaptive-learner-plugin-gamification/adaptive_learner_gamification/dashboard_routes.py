"""Dashboard aggregation routes for the gamification plugin (#572).

Mounted at ``/api/gamification/*`` (a second router with no
``/plugins/`` segment) so the CCW dashboard widgets reach a clean,
compact surface. Thin shell: validate the user, delegate to
:mod:`dashboard_service`, return the Pydantic model.

Single-user desktop app with no auth layer, so the active user is
identified by the required ``user_id`` query parameter the frontend
already holds.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.database import get_db
from app.exceptions import NotFoundError

from . import dashboard_repository, dashboard_service

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

router = APIRouter(prefix="/gamification", tags=["gamification-dashboard"])


class XpHistoryPoint(BaseModel):
    date: str
    xp_earned: int
    total_xp: int


class StreakData(BaseModel):
    current: int
    longest: int
    activeDays: list[str]


class BadgeProgress(BaseModel):
    current: int
    required: int


class BadgeData(BaseModel):
    id: str
    name: str
    description: str
    earned: bool
    earned_at: str | None
    progress: BadgeProgress | None


class XpSummary(BaseModel):
    total_xp: int
    level: int


class GamificationSummary(BaseModel):
    xp: XpSummary
    xp_history: list[XpHistoryPoint]
    streak: StreakData
    badges: list[BadgeData]


def _require_user(db: Session, user_id: str) -> None:
    if not dashboard_repository.user_exists(db, user_id):
        raise NotFoundError(f"User {user_id!r} not found.")


@router.get("/xp-history", response_model=list[XpHistoryPoint])
def get_xp_history(
    user_id: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
) -> list[XpHistoryPoint]:
    """XP earned per day for the last 30 days (activity-derived)."""
    _require_user(db, user_id)
    return [XpHistoryPoint(**point) for point in dashboard_service.xp_history(db, user_id)]


@router.get("/streak", response_model=StreakData)
def get_streak(
    user_id: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
) -> StreakData:
    """Current + longest streak and the active learning days (last 90)."""
    _require_user(db, user_id)
    return StreakData(**dashboard_service.streak(db, user_id))


@router.get("/badges", response_model=list[BadgeData])
def get_badges(
    user_id: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
) -> list[BadgeData]:
    """Every catalog badge with earn-state + progress."""
    _require_user(db, user_id)
    return [BadgeData(**badge) for badge in dashboard_service.badges(db, user_id)]


@router.get("/summary", response_model=GamificationSummary)
def get_summary(
    user_id: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
) -> GamificationSummary:
    """All three widgets in one call to avoid 3 dashboard-load requests."""
    _require_user(db, user_id)
    return GamificationSummary(**dashboard_service.summary(db, user_id))
