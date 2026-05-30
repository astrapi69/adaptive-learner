"""Export data aggregation service (Phase 16A).

Produces format-agnostic, structured payloads for three export
types:

- ``build_progress_report(db, user_id, *, lang="de")`` - the
  learner's overall journey: profile, projects, sessions, method
  distribution, step-evaluation insights, imported-conversation
  analyses.
- ``build_session_detail(db, session_id, *, lang="de")`` - a
  single session with its full message transcript, ratings, and
  step-evaluation timeline.
- ``build_curriculum_overview(db, curriculum_id, *, lang="de")``
  - a curriculum with its topic tree and lessons.

Each returns a plain dict ready for the Markdown / HTML / PDF
renderers in :mod:`frontend/src/lib/export`. The same data shape
is produced by ``frontend/src/storage/export-builder.ts`` so
exports work identically in API and Dexie storage modes.

API keys are never included. Pure aggregation; the routers
serialise to JSON.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app import __version__
from app.exceptions import NotFoundError
from app.models import (
    Curriculum,
    ImportedConversation,
    LearningProfile,
    LearningProject,
    LearningSession,
    LearningTopic,
    Lesson,
    MethodSwitch,
    ProgressCommit,
    SessionMessage,
    SessionRating,
    StepEvaluation,
    User,
)

EXPORT_VERSION = "1.3.0"
EXPORT_FORMAT = "adaptive-learner-export"

# Method keys in canonical order so renderers can rely on a
# stable iteration order without sorting at every layer.
_METHODS: tuple[str, ...] = (
    "deductive",
    "inductive",
    "error_based",
    "dialogic",
    "contextual",
    "ai_adaptive",
)


def _utcnow_iso() -> str:
    return datetime.now(UTC).isoformat()


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _envelope(export_type: str) -> dict[str, Any]:
    """Common header every export carries.

    ``version`` is the export-format version (not the app
    version); ``app_version`` is informational. Renderers read
    ``type`` to dispatch.
    """
    return {
        "format": EXPORT_FORMAT,
        "version": EXPORT_VERSION,
        "type": export_type,
        "generated_at": _utcnow_iso(),
        "app_version": __version__,
    }


# --- Progress Report -------------------------------------------------------


def build_progress_report(
    db: Session,
    user_id: str,
    *,
    lang: str = "de",
) -> dict[str, Any]:
    """Aggregate the user's full learning journey.

    Returns a structured dict ready for the Markdown / PDF
    renderers. Empty collections instead of ``None`` so renderers
    can map over fields without conditional fallbacks.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise NotFoundError(f"User {user_id} not found")

    projects = (
        db.query(LearningProject)
        .filter(LearningProject.user_id == user_id)
        .order_by(LearningProject.created_at.asc())
        .all()
    )
    projects_data = [_project_summary(db, p) for p in projects]

    latest_profile = _latest_profile(db, user_id)
    recent_sessions = _recent_sessions(db, [p.id for p in projects], limit=10)
    step_insights = _step_evaluation_insights(db, [p.id for p in projects])
    extractions = _extraction_summaries(db, user_id)

    return {
        **_envelope("progress_report"),
        "lang": lang,
        "user": {
            "id": user.id,
            "name": user.name,
            "language": user.language,
        },
        "profile": latest_profile,
        "projects": projects_data,
        "recent_sessions": recent_sessions,
        "step_evaluation_insights": step_insights,
        "extractions": extractions,
    }


def _latest_profile(db: Session, user_id: str) -> dict[str, Any] | None:
    """Most recent :class:`LearningProfile` row for the user, or
    ``None`` if the user never completed the assessment."""
    row = (
        db.query(LearningProfile)
        .filter(LearningProfile.user_id == user_id)
        .order_by(LearningProfile.assessed_at.desc())
        .first()
    )
    if row is None:
        return None
    return {
        "deductive": row.deductive,
        "inductive": row.inductive,
        "error_based": row.error_based,
        "dialogic": row.dialogic,
        "contextual": row.contextual,
        "ai_adaptive": row.ai_adaptive,
        "dominant_method": row.dominant_method,
        "assessed_at": _iso(row.assessed_at),
        "version": row.version,
    }


def _project_summary(db: Session, project: LearningProject) -> dict[str, Any]:
    """Per-project aggregate: counts, mean rating, method
    distribution, switch history. Reads :class:`ProgressCommit`
    rows directly so the same numbers Dashboard shows turn up
    here."""
    commits = (
        db.query(ProgressCommit)
        .filter(ProgressCommit.project_id == project.id)
        .order_by(ProgressCommit.committed_at.asc())
        .all()
    )
    switches = (
        db.query(MethodSwitch)
        .filter(MethodSwitch.project_id == project.id)
        .order_by(MethodSwitch.switched_at.asc())
        .all()
    )

    session_count = len(commits)
    total_minutes = sum(c.duration_minutes for c in commits)
    mean_understanding = (
        sum(c.understanding for c in commits) / session_count if session_count else 0.0
    )
    mean_stress = sum(c.stress for c in commits) / session_count if session_count else 0.0

    per_method: dict[str, int] = {m: 0 for m in _METHODS}
    for c in commits:
        if c.method in per_method:
            per_method[c.method] += 1
    distribution = [
        {
            "method": m,
            "count": per_method[m],
            "percentage": (round((per_method[m] * 100) / session_count) if session_count else 0),
        }
        for m in _METHODS
    ]

    return {
        "id": project.id,
        "topic": project.topic,
        "goal": project.goal,
        "timeframe": project.timeframe,
        "daily_minutes": project.daily_minutes,
        "current_problem": project.current_problem,
        "active": project.active,
        "created_at": _iso(project.created_at),
        "session_count": session_count,
        "total_minutes": total_minutes,
        "mean_understanding": round(mean_understanding, 4),
        "mean_stress": round(mean_stress, 4),
        "method_distribution": distribution,
        "method_switches": [
            {
                "from_method": s.from_method,
                "to_method": s.to_method,
                "reason": s.reason,
                "switched_at": _iso(s.switched_at),
            }
            for s in switches
        ],
    }


def _recent_sessions(
    db: Session, project_ids: list[str], *, limit: int = 10
) -> list[dict[str, Any]]:
    """Last ``limit`` sessions across all the user's projects,
    newest first. Each row carries the parent project's topic
    so the Markdown renderer can show context without an extra
    lookup."""
    if not project_ids:
        return []
    sessions = (
        db.query(LearningSession)
        .filter(LearningSession.project_id.in_(project_ids))
        .order_by(LearningSession.started_at.desc())
        .limit(limit)
        .all()
    )
    topic_by_id = {
        p.id: p.topic
        for p in db.query(LearningProject).filter(LearningProject.id.in_(project_ids)).all()
    }
    # Pre-fetch the latest rating per session in ONE query (was an
    # N+1: a per-session SessionRating query inside the loop). Rows
    # come back newest-first, so the first seen per session_id is the
    # latest — ``setdefault`` keeps it.
    session_ids = [s.id for s in sessions]
    rating_by_session: dict[str, SessionRating] = {}
    if session_ids:
        for r in (
            db.query(SessionRating)
            .filter(SessionRating.session_id.in_(session_ids))
            .order_by(SessionRating.created_at.desc())
            .all()
        ):
            rating_by_session.setdefault(r.session_id, r)
    out: list[dict[str, Any]] = []
    for s in sessions:
        rating = rating_by_session.get(s.id)
        duration = _duration_minutes(s.started_at, s.ended_at)
        out.append(
            {
                "id": s.id,
                "project_id": s.project_id,
                "project_topic": topic_by_id.get(s.project_id, ""),
                "method": s.method,
                "started_at": _iso(s.started_at),
                "ended_at": _iso(s.ended_at),
                "duration_minutes": duration,
                "cycle_step": s.cycle_step,
                "status": s.status,
                "rating": _rating_dict(rating),
            }
        )
    return out


def _step_evaluation_insights(db: Session, project_ids: list[str]) -> list[dict[str, Any]] | None:
    """Per-cycle-step aggregates: how often each step was reached,
    advance rate, mean confidence. Returns ``None`` when the user
    has no step-evaluations yet (the section is rendered only when
    there is data to show)."""
    if not project_ids:
        return None
    session_ids = [
        s.id
        for s in db.query(LearningSession).filter(LearningSession.project_id.in_(project_ids)).all()
    ]
    if not session_ids:
        return None
    evaluations = db.query(StepEvaluation).filter(StepEvaluation.session_id.in_(session_ids)).all()
    if not evaluations:
        return None

    per_step: dict[int, list[StepEvaluation]] = {}
    for e in evaluations:
        per_step.setdefault(e.from_step, []).append(e)

    out: list[dict[str, Any]] = []
    for step in sorted(per_step):
        entries = per_step[step]
        count = len(entries)
        advances = sum(1 for e in entries if e.applied and e.to_step > e.from_step)
        repeats = sum(1 for e in entries if e.applied and e.to_step <= e.from_step)
        deferred = sum(1 for e in entries if not e.applied)
        mean_conf = sum(e.confidence for e in entries) / count
        out.append(
            {
                "step": step,
                "count": count,
                "advance_count": advances,
                "repeat_count": repeats,
                "deferred_count": deferred,
                "advance_rate": round(advances / count, 4),
                "mean_confidence": round(mean_conf, 4),
            }
        )
    return out


def _extraction_summaries(db: Session, user_id: str) -> list[dict[str, Any]]:
    """Imported-conversation analysis summaries (Phase 16E hook).

    Returns analyzed conversations only; pending imports are
    excluded so the report stays focused on actionable data.
    Empty list when the user has no analyzed conversations.
    """
    rows = (
        db.query(ImportedConversation)
        .filter(ImportedConversation.user_id == user_id)
        .filter(ImportedConversation.analyzed.is_(True))
        .order_by(ImportedConversation.imported_at.desc())
        .all()
    )
    out: list[dict[str, Any]] = []
    for r in rows:
        analysis: dict[str, Any] = {}
        if r.analysis_result:
            try:
                loaded = json.loads(r.analysis_result)
                if isinstance(loaded, dict):
                    analysis = loaded
            except json.JSONDecodeError:
                analysis = {}
        out.append(
            {
                "id": r.id,
                "title": r.title,
                "source": r.source,
                "message_count": r.message_count,
                "imported_at": _iso(r.imported_at),
                "project_id": r.project_id,
                "topic_tag": r.topic_tag,
                "analysis": analysis,
            }
        )
    return out


# --- Session Detail --------------------------------------------------------


def build_session_detail(
    db: Session,
    session_id: str,
    *,
    lang: str = "de",
) -> dict[str, Any]:
    """Aggregate one session with full transcript + ratings +
    step-evaluation timeline."""
    session = db.query(LearningSession).filter(LearningSession.id == session_id).first()
    if session is None:
        raise NotFoundError(f"Session {session_id} not found")

    project = db.query(LearningProject).filter(LearningProject.id == session.project_id).first()
    messages = (
        db.query(SessionMessage)
        .filter(SessionMessage.session_id == session_id)
        .order_by(SessionMessage.created_at.asc())
        .all()
    )
    rating = (
        db.query(SessionRating)
        .filter(SessionRating.session_id == session_id)
        .order_by(SessionRating.created_at.desc())
        .first()
    )
    evaluations = (
        db.query(StepEvaluation)
        .filter(StepEvaluation.session_id == session_id)
        .order_by(StepEvaluation.evaluated_at.asc())
        .all()
    )

    return {
        **_envelope("session_detail"),
        "lang": lang,
        "session": {
            "id": session.id,
            "project_id": session.project_id,
            "method": session.method,
            "started_at": _iso(session.started_at),
            "ended_at": _iso(session.ended_at),
            "duration_minutes": _duration_minutes(session.started_at, session.ended_at),
            "cycle_step": session.cycle_step,
            "status": session.status,
        },
        "project": _project_context(project),
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "created_at": _iso(m.created_at),
            }
            for m in messages
        ],
        "rating": _rating_dict(rating),
        "step_evaluations": [
            {
                "from_step": e.from_step,
                "to_step": e.to_step,
                "advance": e.advance,
                "confidence": e.confidence,
                "applied": e.applied,
                "fallback_used": e.fallback_used,
                "reason": e.reason,
                "evaluated_at": _iso(e.evaluated_at),
            }
            for e in evaluations
        ],
    }


def _project_context(project: LearningProject | None) -> dict[str, Any] | None:
    if project is None:
        return None
    return {
        "id": project.id,
        "topic": project.topic,
        "goal": project.goal,
        "timeframe": project.timeframe,
    }


def _rating_dict(rating: SessionRating | None) -> dict[str, Any] | None:
    if rating is None:
        return None
    return {
        "understanding": rating.understanding,
        "stress": rating.stress,
        "method_fit": rating.method_fit,
        "notes": rating.notes,
        "created_at": _iso(rating.created_at),
    }


def _duration_minutes(started_at: datetime | None, ended_at: datetime | None) -> int:
    if started_at is None or ended_at is None:
        return 0
    delta = ended_at - started_at
    return max(0, int(delta.total_seconds() // 60))


# --- Curriculum Overview ---------------------------------------------------


def build_curriculum_overview(
    db: Session,
    curriculum_id: str,
    *,
    lang: str = "de",
) -> dict[str, Any]:
    """Aggregate a curriculum with its topic tree + lessons.

    Topics are returned as a flat list with a ``depth`` field; the
    Markdown renderer indents by depth, the PDF renderer styles
    by depth. Order is depth-first traversal of the parent_id
    tree, falling back to insertion order for orphans.
    """
    curriculum = db.query(Curriculum).filter(Curriculum.id == curriculum_id).first()
    if curriculum is None:
        raise NotFoundError(f"Curriculum {curriculum_id} not found")

    topics = (
        db.query(LearningTopic)
        .filter(LearningTopic.curriculum_id == curriculum_id)
        .order_by(LearningTopic.order_index.asc(), LearningTopic.created_at.asc())
        .all()
    )
    lessons = (
        db.query(Lesson)
        .filter(Lesson.curriculum_id == curriculum_id)
        .order_by(Lesson.order_index.asc(), Lesson.created_at.asc())
        .all()
    )

    topic_data = _flatten_topic_tree(topics)

    return {
        **_envelope("curriculum_overview"),
        "lang": lang,
        "curriculum": {
            "id": curriculum.id,
            "title": curriculum.title,
            "description": curriculum.description,
            "language": curriculum.language,
            "created_at": _iso(curriculum.created_at),
            "updated_at": _iso(curriculum.updated_at),
        },
        "topics": topic_data,
        "lessons": [
            {
                "id": lesson.id,
                "title": lesson.title,
                "content": lesson.content,
                "order_index": lesson.order_index,
            }
            for lesson in lessons
        ],
    }


def _flatten_topic_tree(topics: list[LearningTopic]) -> list[dict[str, Any]]:
    """Depth-first traversal that emits one dict per topic with
    a computed ``depth`` field. Orphans (parent_id pointing to a
    nonexistent / deleted parent) are treated as roots.
    """
    by_id = {t.id: t for t in topics}
    children_of: dict[str | None, list[LearningTopic]] = {}
    for t in topics:
        # Orphans -> roots
        parent_key: str | None = t.parent_id if t.parent_id and t.parent_id in by_id else None
        children_of.setdefault(parent_key, []).append(t)

    for siblings in children_of.values():
        siblings.sort(key=lambda x: (x.order_index, x.created_at))

    out: list[dict[str, Any]] = []

    def _walk(parent_id: str | None, depth: int) -> None:
        for t in children_of.get(parent_id, []):
            out.append(
                {
                    "id": t.id,
                    "parent_id": t.parent_id,
                    "title": t.title,
                    "description": t.description,
                    "order_index": t.order_index,
                    "depth": depth,
                }
            )
            _walk(t.id, depth + 1)

    _walk(None, 0)
    return out
