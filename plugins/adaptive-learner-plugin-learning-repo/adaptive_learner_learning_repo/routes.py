"""FastAPI routes for the Learning Repository plugin (Phase 42 / BL-30).

  GET   /api/plugins/learning-repo/render/{project_id}       → {path: content} JSON
  POST  /api/plugins/learning-repo/export-zip/{project_id}   → application/zip
  POST  /api/plugins/learning-repo/persist/{project_id}      → on-disk + git commit

The renderer is sync-read and AI-free. Per-project ownership
gating mirrors the anki / notebooklm pattern: load the project,
404 if absent. The project's owner's ``User.language`` is the
default ``?language=`` value when none is passed.

The ``/persist`` endpoint is the side-effecting variant: it
calls the renderer + writes the tree to disk + ``git commit``
under ``{repos_dir}/{project_id}/``. Opt-in via
``settings.enable_git: true`` in
``backend/config/plugins/learning-repo.yaml``.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError, ValidationError
from app.models import LearningProject, User

from .git_writer import persist_to_disk_and_commit
from .renderer import load_context, render_from_context
from .zip_builder import build_zip, slugify_for_filename

router = APIRouter(prefix="/plugins/learning-repo", tags=["learning-repo"])
logger = logging.getLogger(__name__)

_DEFAULT_REPOS_DIR = "~/.local/share/adaptive_learner/repos"


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


def _plugin_settings() -> dict[str, object]:
    """Read this plugin's settings via the PluginForge manager.

    Lazy import of ``app.main.manager`` mirrors the pattern in
    anki's ``_build_ai_caller``. Returns an empty dict if the
    plugin isn't registered (defensive — the route is only
    reachable while it IS registered, but a stale lookup
    shouldn't 500).
    """

    from app.main import manager  # lazy: cycle-avoidance + tests

    plugin = manager.get_plugin("learning-repo")
    if plugin is None:
        return {}
    config = getattr(plugin, "config", {}) or {}
    settings = config.get("settings") or {}
    return settings if isinstance(settings, dict) else {}


def _resolved_repos_dir() -> Path:
    settings = _plugin_settings()
    raw = settings.get("repos_dir") or _DEFAULT_REPOS_DIR
    return Path(str(raw)).expanduser()


def _git_enabled() -> bool:
    return bool(_plugin_settings().get("enable_git"))


# --- Persist response shape ------------------------------------------------


class PersistResponse(BaseModel):
    """The JSON shape returned by ``POST /persist/{project_id}``."""

    project_id: str
    language: str
    rendered_at: datetime
    files_written: int
    repo_path: str
    commit_sha: str
    tag: str | None = Field(
        default=None,
        description=(
            "``cycle-{N}-mastered`` when the Article-1 § 8 exit "
            "threshold is met at this cycle; ``null`` otherwise."
        ),
    )


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


@router.post("/persist/{project_id}", response_model=PersistResponse)
def persist(
    project_id: str,
    language: str | None = None,
    db: Session = Depends(get_db),
) -> PersistResponse:
    """Render + write to disk + ``git commit`` under
    ``{repos_dir}/{project_id}/``.

    Side-effecting variant of ``/render``. Disabled by default —
    ``enable_git: true`` must be set in
    ``backend/config/plugins/learning-repo.yaml`` first.
    Returns the commit SHA, file count, repo path, and the
    ``cycle-{N}-mastered`` tag name when this commit just
    achieved the Article-1 § 8 exit threshold.
    """

    if not _git_enabled():
        raise ValidationError(
            "Git persistence is disabled. Set settings.enable_git=true in "
            "backend/config/plugins/learning-repo.yaml to opt in."
        )
    project = _get_project(db, project_id)
    resolved_language = language or _default_language(db, project)
    ctx = load_context(db, project_id)
    files = render_from_context(ctx, resolved_language)
    result = persist_to_disk_and_commit(files, _resolved_repos_dir(), project_id, ctx)
    return PersistResponse(
        project_id=project_id,
        language=resolved_language,
        rendered_at=ctx.rendered_at,
        files_written=result.files_written,
        repo_path=str(result.repo_path),
        commit_sha=result.commit_sha,
        tag=result.tag,
    )
