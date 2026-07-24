"""FastAPI routes for the tools plugin.

  GET /api/plugins/tools/recommendations/{project_id}?lang=…
  GET /api/plugins/tools/spaced/{project_id}?lang=…

The first reads the latest LearningProfile for the project
(assessment plugin populates it via
``POST /api/plugins/assessment/evaluate``) and aggregates every
``get_tool_recommendations`` impl into a single sorted list.
Future tools-plugins stack their own catalogue on the same hook;
this route merges everyone's lists into one.

The second (v0.4.0) returns spaced-repetition action cards
("Refresh deduction", "Practice dialogue", ...) driven by the
profile's method-weights AND the recency of recent
ProgressCommit rows. See
:mod:`adaptive_learner_tools.spaced_recommendations` for the
band-policy.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError
from app.models import LearningProfile, LearningProject, ProgressCommit

from .catalogue import METHODS
from .spaced_recommendations import build_spaced_recommendations, localise

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


def _recency_days(
    db: Session, project_id: str, now: datetime | None = None
) -> dict[str, float | None]:
    """Days since the most recent ProgressCommit per method.

    ``None`` when the method has never been committed for this
    project. ``now`` is injectable for tests; production reads
    UTC at call time.
    """
    current = now if now is not None else datetime.now(UTC)
    out: dict[str, float | None] = {m: None for m in METHODS}
    rows = (
        db.query(ProgressCommit.method, ProgressCommit.committed_at)
        .filter(ProgressCommit.project_id == project_id)
        .all()
    )
    for method, committed_at in rows:
        if method not in out:
            continue
        ts = committed_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)
        delta_days = (current - ts).total_seconds() / 86400.0
        prior = out[method]
        if prior is None or delta_days < prior:
            out[method] = delta_days
    return out


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


@router.get("/spaced/{project_id}")
def get_spaced_recommendations(
    project_id: str, lang: str = "de", db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    """v0.4.0 - spaced-repetition action cards for the Dashboard.

    Driven by the project's profile + recent ProgressCommit
    recency. Returns an empty list when no profile exists yet
    (no methods to recommend); the Dashboard renders an
    empty-state card pointing the user at the assessment.
    """
    if db.get(LearningProject, project_id) is None:
        raise NotFoundError(f"LearningProject {project_id!r} not found.")
    profile = _profile_dict(db, project_id)
    recency = _recency_days(db, project_id)
    cards = build_spaced_recommendations(profile, recency)
    return [localise(card, lang) for card in cards]
