"""FastAPI routes for the missions plugin (EXP-010 / Phase 56)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db

from . import service
from .catalog import load_templates

router = APIRouter(prefix="/plugins/missions", tags=["missions"])


@router.get("/templates")
def get_templates() -> list[dict[str, Any]]:
    """Return the full static mission catalog."""
    return [template.model_dump(mode="json") for template in load_templates()]


@router.get("/today/{user_id}")
def get_today(
    user_id: str,
    count: int = Query(default=3, ge=1, le=3),
    difficulty_mix: str = Query(default="balanced"),
    today: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict[str, list[dict[str, Any]]]:
    """Today's missions for the user (assigns on first call,
    re-evaluates live progress on every call)."""
    return service.get_daily(
        db,
        user_id,
        count=count,
        difficulty_mix=difficulty_mix,
        today_iso=today,
    )


@router.post("/regenerate/{user_id}")
def regenerate(
    user_id: str,
    count: int = Query(default=3, ge=1, le=3),
    difficulty_mix: str = Query(default="balanced"),
    today: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict[str, list[dict[str, Any]]]:
    """Discard + reassign today's missions (Settings reset)."""
    return service.regenerate(
        db,
        user_id,
        count=count,
        difficulty_mix=difficulty_mix,
        today_iso=today,
    )
