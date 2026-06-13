"""Route-layer helpers for the session plugin (#411).

Extracted from ``routes.py`` so the route module stays thin. These are the
DB-fetch + dict-shaping helpers the endpoints share, plus the
``on_session_complete`` hook wrapper and the language-project check used by the
pronunciation endpoints. All keep their original behaviour verbatim.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models import (
    ImportedConversation,
    LearningProfile,
    LearningProject,
    LearningSession,
)

from .prompts import METHODS, build_analysis_context


def _get_project(db: Session, project_id: str) -> LearningProject:
    project = db.get(LearningProject, project_id)
    if project is None:
        raise NotFoundError(f"LearningProject {project_id!r} not found.")
    return project


def _get_session(db: Session, session_id: str) -> LearningSession:
    sess = db.get(LearningSession, session_id)
    if sess is None:
        raise NotFoundError(f"LearningSession {session_id!r} not found.")
    return sess


def _latest_profile(db: Session, project_id: str) -> LearningProfile | None:
    return (
        db.query(LearningProfile)
        .filter(LearningProfile.project_id == project_id)
        .order_by(LearningProfile.version.desc())
        .first()
    )


def _profile_to_dict(profile: LearningProfile | None) -> dict[str, Any]:
    if profile is None:
        return {}
    return {m: float(getattr(profile, m, 0.0)) for m in METHODS}


def _project_to_dict(project: LearningProject) -> dict[str, Any]:
    return {
        "id": project.id,
        "user_id": project.user_id,
        "topic": project.topic,
        "goal": project.goal,
        "timeframe": project.timeframe,
        "daily_minutes": project.daily_minutes,
        "current_problem": project.current_problem,
    }


def _pick_initial_method(profile: LearningProfile | None, fallback: str = "deductive") -> str:
    """Use the profile's dominant method when one exists; otherwise
    fall back to ``deductive`` (the most universally-applicable
    method for a brand-new learner).
    """
    if profile is None:
        return fallback
    return profile.dominant_method or fallback


def _analysis_context_for(db: Session, imported_conversation_id: str | None, lang: str) -> str:
    """Render the imported conversation's analysis as a prompt addendum.

    Loads ``ImportedConversation.analysis_result`` (stored as a JSON
    string), parses it, and delegates to
    :func:`build_analysis_context`. Returns ``""`` when there is no
    conversation, no analysis, or the JSON is unusable, so the caller
    can append unconditionally.
    """
    if not imported_conversation_id:
        return ""
    conv = db.get(ImportedConversation, imported_conversation_id)
    if conv is None or not conv.analysis_result:
        return ""
    try:
        parsed = json.loads(conv.analysis_result)
    except (TypeError, json.JSONDecodeError):
        return ""
    if not isinstance(parsed, dict):
        return ""
    return build_analysis_context(parsed, lang)


def _fire_on_session_complete(session: dict[str, Any], rating: dict[str, Any]) -> None:
    """Wrap the hook call so subscriber exceptions don't propagate
    into the route response. Logs but does not raise."""
    try:
        # Lazy import: avoids a circular dependency with app.main
        # at module load (the route module gets imported during
        # PluginForge discovery, which itself runs from
        # app.main.lifespan).
        from app.main import manager

        manager._pm.hook.on_session_complete(session=session, rating=rating)
    except Exception:
        logging.getLogger(__name__).warning(
            "on_session_complete subscriber raised; session close not affected",
            exc_info=True,
        )


def _is_language_project(db: Session, project_id: str) -> bool:
    """True iff the project has at least one Subject under the
    ``languages`` slug (transitive — direct or via the
    ancestor chain). Used by the dashboard to decide whether to
    surface the Pronunciation quick-start.

    Returns False when the project has no subjects assigned —
    intentional graceful degradation (the page stays hidden
    rather than guessing from the topic string).
    """
    from app.models import ProjectSubject, Subject

    rows = (
        db.query(Subject)
        .join(ProjectSubject, ProjectSubject.subject_id == Subject.id)
        .filter(ProjectSubject.project_id == project_id)
        .all()
    )
    if not rows:
        return False
    # Walk each subject up the parent chain looking for the
    # ``languages`` ancestor.
    visited: set[str] = set()
    for start in rows:
        cursor: Subject | None = start
        while cursor is not None and cursor.id not in visited:
            visited.add(cursor.id)
            if cursor.name.lower() in ("languages", "sprachen"):
                return True
            if cursor.parent_id is None:
                break
            cursor = db.get(Subject, cursor.parent_id)
    return False
