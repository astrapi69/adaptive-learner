"""Pseudo-project + LearningSession write on content-lesson completion.

Phase 46F (v1.31.0 / P-129 — decisions D1, D2, D5) closes the
loop between the content-lesson viewer (Phase 44-46) and the
existing six-method session machinery. When a
``LessonProgress`` row flips from ``in_progress`` to
``completed``, this module:

1. Finds-or-creates the user's **"Content Lessons"
   pseudo-project** (``kind="content"``). One per user,
   created lazily on first lesson completion — never seeded
   during onboarding (D1).
2. Writes a **``LearningSession``** row against that project
   with ``method="content"`` (D2 — added as the 7th method
   value specifically for this unification path) and
   ``status="completed"``.
3. Fires the **``on_session_complete``** pluggy hook so the
   gamification + tracking plugins' existing handlers can
   award XP / evaluate badges / write a ProgressCommit
   without any new hookspec (D5 — reuse, don't extend).

The hook-fire path mirrors the session plugin's existing
``_fire_on_session_complete`` (see ``plugins/.../session/
adaptive_learner_session/routes.py``): subscriber exceptions
are caught + logged so a gamification crash never rolls back
the lesson completion. Errors raised inside this module's own
work (project/session writes) DO propagate — they signal a
real DB problem the caller needs to handle.

Frontend project pickers filter out ``kind="content"`` so the
pseudo-project never appears as a legit learning goal — see
``LEARNING_PROJECT_KINDS`` in ``app/models/__init__.py``.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from app.models import LearningProject, LearningSession
from app.repositories.lesson_session_unification_repo import (
    LessonSessionUnificationRepository,
)

logger = logging.getLogger(__name__)

# v1.31.0 / Phase 46F (D2): the 7th method value, used ONLY
# for the lesson-completion unification path. The other six
# (deductive / inductive / error_based / dialogic /
# contextual / ai_adaptive) cover the chat-session machinery.
CONTENT_LESSON_METHOD = "content"

# Shape of the pseudo-project row. Topic + goal are visible
# only in DB browsers / sync audits — frontend pickers filter
# it out by kind. Daily-minutes is set to 1 (the minimum the
# Pydantic validator accepts) since the field is irrelevant
# for an auto-managed project.
_PSEUDO_PROJECT_TOPIC = "Content Lessons"
_PSEUDO_PROJECT_GOAL = (
    "Auto-managed pseudo-project that owns LearningSession "
    "rows for completed content lessons. Created lazily on "
    "first lesson completion (Phase 46F / v1.31.0); filtered "
    "out of project pickers via kind='content'."
)
_PSEUDO_PROJECT_TIMEFRAME = "ongoing"
_PSEUDO_PROJECT_DAILY_MINUTES = 1


def find_or_create_content_pseudo_project(
    repo: LessonSessionUnificationRepository, user_id: str
) -> LearningProject:
    """Return the user's content pseudo-project, creating it if missing.

    Identified by ``(user_id, kind="content")``. Idempotent:
    callers that complete multiple lessons in the same
    request reuse the same row. The caller is responsible
    for committing — the create path ``flush`` es so the new id
    is visible inside the transaction but does not commit.
    """
    proj = repo.get_content_pseudo_project(user_id)
    if proj is not None:
        return proj
    return repo.create_pseudo_project(
        user_id=user_id,
        topic=_PSEUDO_PROJECT_TOPIC,
        goal=_PSEUDO_PROJECT_GOAL,
        timeframe=_PSEUDO_PROJECT_TIMEFRAME,
        daily_minutes=_PSEUDO_PROJECT_DAILY_MINUTES,
    )


def record_lesson_completion_session(
    repo: LessonSessionUnificationRepository,
    *,
    user_id: str,
    lesson_progress_id: str,
    score_correct: int,
    score_total: int,
) -> LearningSession:
    """Persist a LearningSession + fire on_session_complete.

    Called when a LessonProgress flips from in_progress to
    completed. Commits its own transaction so the hook
    subscribers see a consistent DB. Returns the new
    LearningSession.

    The session dict passed to the hook includes the standard
    fields the existing gamification + tracking handlers
    consume PLUS three lesson-specific fields
    (``lesson_progress_id``, ``score_correct``,
    ``score_total``) that 46E.1's XP rule will read to
    compute the per-star bonus. Existing handlers that
    ignore unknown keys keep working unchanged.
    """
    project = find_or_create_content_pseudo_project(repo, user_id)
    now = datetime.now(UTC)
    sess = repo.create_completed_session(
        project_id=project.id,
        method=CONTENT_LESSON_METHOD,
        started_at=now,
        ended_at=now,
        cycle_step=1,
        status="completed",
    )

    _fire_on_session_complete(
        session={
            "id": sess.id,
            "project_id": sess.project_id,
            "method": sess.method,
            "cycle_step": sess.cycle_step,
            "cycle_count": 1,
            "started_at": sess.started_at.isoformat(),
            "ended_at": sess.ended_at.isoformat() if sess.ended_at else None,
            "status": sess.status,
            "lesson_progress_id": lesson_progress_id,
            "score_correct": score_correct,
            "score_total": score_total,
        },
        rating={},
    )
    return sess


def _fire_on_session_complete(session: dict[str, Any], rating: dict[str, Any]) -> None:
    """Mirror of session plugin's ``_fire_on_session_complete``.

    Wraps subscriber exceptions so a gamification crash
    doesn't roll back the lesson completion. Logs at
    WARNING. Lazy-imports ``app.main`` because this module
    is loaded during the FastAPI lifespan that constructs
    ``manager`` — eager import would deadlock.
    """
    try:
        from app.main import manager

        manager._pm.hook.on_session_complete(session=session, rating=rating)
    except Exception:
        logger.warning(
            "on_session_complete subscriber raised; lesson completion not affected",
            exc_info=True,
        )
