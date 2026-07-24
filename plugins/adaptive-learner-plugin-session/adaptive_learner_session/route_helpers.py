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
    ElementError,
    ImportedConversation,
    ImportedMessage,
    LearningProfile,
    LearningProject,
    LearningSession,
    LessonProgress,
)

from .prompts import (
    METHODS,
    CompletedLesson,
    ConversationTurn,
    InProgressLesson,
    LearningContext,
    RecentMistake,
    build_analysis_context,
    build_conversation_context,
    build_language_directive,
    build_learning_context,
    build_prompt,
)


def _humanize_lesson_label(set_id: str, lesson_filename: str) -> str:
    """A readable ``<set> - <lesson>`` label from the cache ids.

    The lesson filename (``01-greetings.json``) is stripped + spaced
    (``01 greetings``); resolving the authored lesson title would need a
    content-loader round-trip per lesson, so the id-derived label is used
    instead — enough for the AI to recognise which lesson is meant.
    """
    lesson = lesson_filename.rsplit("/", 1)[-1]
    if lesson.endswith(".json"):
        lesson = lesson[: -len(".json")]
    lesson = lesson.replace("-", " ").replace("_", " ").strip()
    return f"{set_id} - {lesson}" if lesson else set_id


def _learning_context_for(db: Session, project: LearningProject, lang: str) -> str:
    """Render the learner's lesson progress + recent mistakes as a prompt
    addendum so a new AI session is aware of completed content, the lesson
    in progress, and the elements the learner keeps missing (#797).

    Reads only what already exists (``LessonProgress`` + ``ElementError``
    for the project's user); returns ``""`` for a learner with no lesson
    activity so the caller can append unconditionally.
    """
    rows = db.query(LessonProgress).filter(LessonProgress.user_id == project.user_id).all()
    completed_rows = sorted(
        (r for r in rows if r.status == "completed"),
        key=lambda r: r.completed_at or r.updated_at or "",
        reverse=True,
    )
    completed = [
        CompletedLesson(
            label=_humanize_lesson_label(r.set_id, r.lesson_filename),
            correct=r.score_correct or 0,
            total=r.score_total or 0,
        )
        for r in completed_rows
    ]
    active_rows = sorted(
        (r for r in rows if r.status in ("in_progress", "paused")),
        key=lambda r: r.updated_at or "",
        reverse=True,
    )
    in_progress = None
    if active_rows:
        latest = active_rows[0]
        in_progress = InProgressLesson(
            label=_humanize_lesson_label(latest.set_id, latest.lesson_filename),
            step=(latest.current_step or 0) + 1,
        )
    error_rows = sorted(
        (
            e
            for e in db.query(ElementError)
            .filter(
                ElementError.user_id == project.user_id,
                ElementError.mastered.is_(False),
            )
            .all()
        ),
        key=lambda e: e.last_attempt_at or e.last_error_at or "",
        reverse=True,
    )
    mistakes = [
        RecentMistake(
            element=e.element_key,
            answered=e.user_answer or "",
            expected=e.correct_answer or "",
            count=e.error_count or 0,
        )
        for e in error_rows
    ]
    context = LearningContext(
        topic=project.topic,
        completed=completed,
        in_progress=in_progress,
        mistakes=mistakes,
    )
    return build_learning_context(context, lang)


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


def _conversation_context_for(
    db: Session, imported_conversation_id: str | None, lang: str
) -> str:
    """Render the imported chat's raw transcript as a prompt addendum (#1078).

    Loads the conversation's ``ImportedMessage`` rows in chronological order
    (``order_index``) and delegates to :func:`build_conversation_context`,
    which keeps the most recent turns within the token budget. Returns ``""``
    when there is no conversation or it has no messages, so the caller can
    append unconditionally.
    """
    if not imported_conversation_id:
        return ""
    rows = (
        db.query(ImportedMessage)
        .filter(ImportedMessage.conversation_id == imported_conversation_id)
        .order_by(ImportedMessage.order_index)
        .all()
    )
    turns = [ConversationTurn(role=row.role, content=row.content) for row in rows]
    return build_conversation_context(turns, lang)


def compose_system_prompt(
    db: Session,
    *,
    project: LearningProject,
    profile: LearningProfile | None,
    method: str,
    step: int,
    lang: str | None,
    imported_conversation_id: str | None,
) -> str:
    """Compose the full session system prompt from its live sources.

    Assembles the method/step prompt cell (#827 matrix) + the
    output-language directive (#827), then EITHER the imported-conversation
    blocks (analysis #827 + raw transcript #1078) when the session is linked
    to a chat import, OR the learner's lesson-progress block (#797) for a
    normal session — never both.

    The imported-vs-learning branch is the #1137 fix: an imported chat IS
    the topical focus, so the ``Currently working on: <lesson>`` line from
    the #797 block must NOT be folded in for imported sessions — it pulls the
    tutor onto an unrelated in-progress lesson (the "Inception" drift).

    Re-reads every block from the DB so the result reflects the CURRENT
    state, not a snapshot; that is what makes the #1122 rebuild-on-resume
    correct (later context improvements reach existing imported sessions).

    Mirrors the Dexie-mode ``composeSystemPrompt`` in
    ``frontend/src/storage/ai/session-flow.ts``.

    Args:
        db: SQLAlchemy session.
        project: The session's learning project.
        profile: The latest LearningProfile, or ``None``.
        method: The session method key (e.g. ``deductive``).
        step: The current cycle step (1-7).
        lang: UI / output language for the prompt + block labels.
        imported_conversation_id: The linked chat-import FK, or ``None``.

    Returns:
        The composed system prompt string.

    Raises:
        ValueError: when ``build_prompt`` rejects the method/step combo.
    """
    prompt = build_prompt(
        project=_project_to_dict(project),
        profile=_profile_to_dict(profile),
        method=method,
        step=step,
        lang=lang,
    )
    prompt = f"{prompt}\n\n{build_language_directive(lang)}"
    if imported_conversation_id:
        analysis_block = _analysis_context_for(db, imported_conversation_id, lang)
        if analysis_block:
            prompt = f"{prompt}\n\n{analysis_block}"
        conversation_block = _conversation_context_for(db, imported_conversation_id, lang)
        if conversation_block:
            prompt = f"{prompt}\n\n{conversation_block}"
    else:
        learning_block = _learning_context_for(db, project, lang)
        if learning_block:
            prompt = f"{prompt}\n\n{learning_block}"
    return prompt


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
