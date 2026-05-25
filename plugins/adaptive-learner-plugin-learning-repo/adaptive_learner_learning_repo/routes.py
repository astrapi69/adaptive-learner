"""FastAPI routes for the Learning Repository plugin (Phase 42 / BL-30).

  GET   /api/plugins/learning-repo/render/{project_id}       → {path: content} JSON
  POST  /api/plugins/learning-repo/export-zip/{project_id}   → application/zip

The renderer is sync-read and AI-free. Per-project ownership
gating mirrors the anki / notebooklm pattern: load the project,
404 if absent. The project's owner's ``User.language`` is the
default ``?language=`` value when none is passed.
"""

from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError
from app.models import LearningProject, User

from .renderer import load_context, render_from_context
from .zip_builder import build_zip, slugify_for_filename

router = APIRouter(prefix="/plugins/learning-repo", tags=["learning-repo"])
logger = logging.getLogger(__name__)


# --- Response shape ---------------------------------------------------------


class RenderResponse(BaseModel):
    """The JSON shape returned by ``GET /render/{project_id}``."""

    project_id: str
    language: str
    rendered_at: datetime
    files: dict[str, str] = Field(description="Map of repo-relative path → file content.")


# --- Helpers ----------------------------------------------------------------


def _get_project(db: Session, project_id: str) -> LearningProject:
    project = db.get(LearningProject, project_id)
    if project is None:
        raise NotFoundError(f"LearningProject {project_id!r} not found.")
    return project


def _default_language(db: Session, project: LearningProject) -> str:
    """The project owner's UI language. Falls back to ``"en"``
    if the user row is somehow missing (shouldn't happen — the
    FK forbids it — but the renderer must not 500 on edge
    cases that the DB allowed)."""

    user = db.get(User, project.user_id)
    if user is None or not user.language:
        return "en"
    return user.language


# --- Endpoints --------------------------------------------------------------


@router.get("/render/{project_id}", response_model=RenderResponse)
def render(
    project_id: str,
    language: str | None = None,
    db: Session = Depends(get_db),
) -> RenderResponse:
    """Project → repo tree as JSON. No on-disk side effects."""

    project = _get_project(db, project_id)
    resolved_language = language or _default_language(db, project)
    ctx = load_context(db, project_id)
    files = render_from_context(ctx, resolved_language)
    return RenderResponse(
        project_id=project_id,
        language=resolved_language,
        rendered_at=ctx.rendered_at,
        files=files,
    )


@router.post("/export-zip/{project_id}")
def export_zip(
    project_id: str,
    language: str | None = None,
    db: Session = Depends(get_db),
) -> Response:
    """Same content as ``/render``, packaged as a ZIP download.

    Filename: ``{project_slug}-learning-repo.zip``. No timestamp
    in the filename (the file content already carries
    ``rendered_at``); downloaded duplicates land as
    ``foo-learning-repo (1).zip`` per the browser's default
    behaviour, which is the right UX for "I just want the
    latest snapshot".
    """

    project = _get_project(db, project_id)
    resolved_language = language or _default_language(db, project)
    files = render_from_context(load_context(db, project_id), resolved_language)
    payload = build_zip(files)
    slug = slugify_for_filename(project.topic)
    filename = f"{slug}-learning-repo.zip"
    return Response(
        content=payload,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
