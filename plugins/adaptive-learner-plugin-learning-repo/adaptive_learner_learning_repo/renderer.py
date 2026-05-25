"""Orchestrator for the learning-repo renderer (Phase 42 / BL-30).

Public entry points:

  * :func:`load_context` — sync DB read, builds a
    :class:`RenderContext` for one project. Raises
    ``NotFoundError`` when the project doesn't exist.
  * :func:`render_repository` — high-level: load context, dispatch
    to every meta-file generator, build the topic folder stubs,
    return ``{path: content}`` for the whole tree.

No AI calls anywhere on this path. Renderer ignores
authorisation — the route layer (commit 4) is the right place
for per-user gating.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .context import RenderContext, derive_topics
from .labels import labels_for
from .meta import render_cheatsheet, render_readme, render_roadmap, render_stats
from .topic_folders import render_topic_folders

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def load_context(db: Session, project_id: str) -> RenderContext:
    """Build a :class:`RenderContext` for one project (sync read).

    ``app.*`` imports are function-local so the module stays
    importable in plugin-smoke-test contexts where the backend
    package isn't on sys.path. Matches the lazy-import pattern
    used by anki/notebooklm.
    """

    from sqlalchemy import select

    from app.exceptions import NotFoundError
    from app.models import (
        LearningProject,
        LearningSession,
        MethodSwitch,
        SessionNote,
        SessionRating,
        StepEvaluation,
    )

    project = db.get(LearningProject, project_id)
    if project is None:
        raise NotFoundError(f"LearningProject {project_id} not found")
    sessions = tuple(
        db.scalars(select(LearningSession).where(LearningSession.project_id == project_id))
    )
    session_ids = [s.id for s in sessions]
    ratings = tuple(
        db.scalars(select(SessionRating).where(SessionRating.session_id.in_(session_ids)))
        if session_ids
        else ()
    )
    step_evaluations = tuple(
        db.scalars(select(StepEvaluation).where(StepEvaluation.session_id.in_(session_ids)))
        if session_ids
        else ()
    )
    notes = tuple(
        db.scalars(select(SessionNote).where(SessionNote.session_id.in_(session_ids)))
        if session_ids
        else ()
    )
    method_switches = tuple(
        db.scalars(select(MethodSwitch).where(MethodSwitch.project_id == project_id))
    )
    topics = derive_topics(sessions)
    return RenderContext(
        project=project,
        sessions=sessions,
        ratings=ratings,
        step_evaluations=step_evaluations,
        method_switches=method_switches,
        notes=notes,
        topics=topics,
    )


def render_repository(
    db: Session,
    project_id: str,
    language: str = "en",
) -> dict[str, str]:
    """Build the full ``{path: content}`` map for one project."""

    ctx = load_context(db, project_id)
    return render_from_context(ctx, language)


def render_from_context(ctx: RenderContext, language: str = "en") -> dict[str, str]:
    """Dispatch to every generator. Pure function of the context.

    Split out so tests can build a context fixture and exercise
    the full dispatch without a DB round-trip.
    """

    labels = labels_for(language)
    tree: dict[str, str] = {
        "README.md": render_readme(ctx, labels),
        "LEARNING_STATS.md": render_stats(ctx, labels),
        "CHEATSHEET.md": render_cheatsheet(ctx, labels),
        "ROADMAP.md": render_roadmap(ctx, labels),
    }
    tree.update(render_topic_folders(ctx, labels))
    return tree
