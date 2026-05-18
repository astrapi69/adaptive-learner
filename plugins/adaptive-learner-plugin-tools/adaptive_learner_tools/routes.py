"""FastAPI route for the tools plugin.

  GET /api/plugins/tools/recommendations/{project_id}?lang=…

Reads the latest LearningProfile for the project (assessment
plugin populates it via POST /api/plugins/assessment/evaluate)
and aggregates every ``get_tool_recommendations`` impl into a
single sorted list. Future tools-plugins stack their own catalogue
on the same hook; this route merges everyone's lists into one.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError
from app.models import LearningProfile, LearningProject

from .catalogue import METHODS

router = APIRouter(prefix="/plugins/tools", tags=["tools"])


def _profile_dict(db: Session, project_id: str) -> dict[str, Any]:
    """Latest profile for the project as a plain dict. Empty
    when the project has never been assessed (the rank function
    handles that by keeping the authored catalogue order)."""
    row = (
        db.query(LearningProfile)
        .filter(LearningProfile.project_id == project_id)
        .order_by(LearningProfile.version.desc())
        .first()
    )
    if row is None:
        return {}
    return {m: float(getattr(row, m, 0.0)) for m in METHODS}


@router.get("/recommendations/{project_id}")
def get_recommendations(
    project_id: str, lang: str = "de", db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    if db.get(LearningProject, project_id) is None:
        raise NotFoundError(f"LearningProject {project_id!r} not found.")

    profile = _profile_dict(db, project_id)

    # Lazy import: avoids a circular dependency at module load
    # (the route module is imported during PluginForge discovery,
    # which runs inside app.main.lifespan).
    from app.main import manager

    raw_results = manager._pm.hook.get_tool_recommendations(profile=profile, lang=lang)
    merged: list[dict[str, Any]] = []
    for entry in raw_results:
        if isinstance(entry, list):
            merged.extend(entry)
    # Re-sort the merged list by score so a future second tools
    # plugin's catalogue interleaves cleanly with this one.
    merged.sort(key=lambda r: r.get("score", 0.0), reverse=True)
    return merged
