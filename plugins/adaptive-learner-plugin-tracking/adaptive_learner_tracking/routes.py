"""FastAPI routes for the tracking plugin.

  GET /api/plugins/tracking/progress/{project_id}  -> aggregated summary
  GET /api/plugins/tracking/commits/{project_id}   -> list[ProgressCommitOut]

The /progress route shallow-merges every ``get_progress_summary``
implementation so a future analytics plugin can stack its own
namespace on the same response without touching this code.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError
from app.models import LearningProject, ProgressCommit, SessionRating
from app.schemas import ProgressCommitOut

router = APIRouter(prefix="/plugins/tracking", tags=["tracking"])


def _ensure_project(db: Session, project_id: str) -> None:
    if db.get(LearningProject, project_id) is None:
        raise NotFoundError(f"LearningProject {project_id!r} not found.")


@router.get("/progress/{project_id}")
def get_progress(project_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    _ensure_project(db, project_id)

    # Lazy import: the manager lives in app.main and isn't on
    # sys.path during the plugin's standalone test suite.
    from app.main import manager

    raw_results = manager._pm.hook.get_progress_summary(project_id=project_id)
    merged: dict[str, Any] = {}
    for entry in raw_results:
        if isinstance(entry, dict):
            merged.update(entry)
    return merged


@router.get("/commits/{project_id}", response_model=list[ProgressCommitOut])
def list_commits(project_id: str, db: Session = Depends(get_db)) -> list[ProgressCommitOut]:
    """Return the project's commits joined with each session's rating notes.

    v1.14.0 / Phase 27B: the response now includes a ``notes``
    field per commit, sourced from the LEFT-joined SessionRating.
    Sessions without a rating row (incomplete sessions) return
    ``notes=None``. The note text may be legacy plain text or a
    serialised TipTap JSON document; the frontend's
    ``content-utils`` handles both shapes.
    """
    _ensure_project(db, project_id)
    rows = (
        db.query(ProgressCommit, SessionRating.notes)
        .outerjoin(
            SessionRating, SessionRating.session_id == ProgressCommit.session_id
        )
        .filter(ProgressCommit.project_id == project_id)
        .order_by(ProgressCommit.committed_at.asc())
        .all()
    )
    return [
        ProgressCommitOut(
            id=commit.id,
            project_id=commit.project_id,
            session_id=commit.session_id,
            method=commit.method,
            understanding=commit.understanding,
            stress=commit.stress,
            error_rate=commit.error_rate,
            duration_minutes=commit.duration_minutes,
            committed_at=commit.committed_at,
            notes=notes,
        )
        for commit, notes in rows
    ]
