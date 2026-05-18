"""FastAPI routes for the session plugin.

  POST /api/plugins/session/start              -> SessionStartOut
  POST /api/plugins/session/{id}/message       -> SessionMessageOut
  POST /api/plugins/session/{id}/rate          -> SessionRatingOut
  POST /api/plugins/session/{id}/end           -> SessionEndOut

POST /start:
  Body: {project_id, method?, cycle_step?, lang?}. If ``method`` is
  omitted, the latest LearningProfile's dominant method seeds it
  (falls back to ``deductive`` when no profile exists). Returns
  the new session + the composed system prompt for the frontend
  to ship to the AI provider.

POST /message:
  Body: {role, content}. Stores one chat message. The AI-call
  orchestration lives client-side: the frontend (or any external
  caller) sends the user's text, calls the AI via the ai_complete
  hook through its own integration, then posts the assistant
  reply back. Decouples the session model from any one provider's
  call shape.

POST /rate:
  Body: {understanding, stress, method_fit, notes?}. Persists a
  SessionRating row.

POST /end:
  Body: optional. Marks the session ``completed`` + ``ended_at``,
  fires the ``on_session_complete`` hook so the tracking plugin
  (Phase 3-D) can write its ProgressCommit row.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError, ValidationError
from app.models import (
    LearningProfile,
    LearningProject,
    LearningSession,
    SessionMessage,
    SessionRating,
)
from app.schemas import (
    LearningMethod,
    LearningSessionOut,
    MessageRole,
    SessionMessageOut,
    SessionRatingOut,
)

from .prompts import MAX_STEP, METHODS, MIN_STEP, build_prompt

router = APIRouter(prefix="/plugins/session", tags=["session"])


# --- Body / response schemas (plugin-local) -------------------------------


class _StartBody(BaseModel):
    project_id: str = Field(min_length=1)
    method: LearningMethod | None = None
    cycle_step: int = Field(default=1, ge=MIN_STEP, le=MAX_STEP)
    lang: str = "de"


class _SessionStartOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session: LearningSessionOut
    system_prompt: str


class _MessageBody(BaseModel):
    role: MessageRole
    content: str = Field(min_length=1)


class _RatingBody(BaseModel):
    understanding: int = Field(ge=1, le=5)
    stress: int = Field(ge=1, le=5)
    method_fit: int = Field(ge=1, le=5)
    notes: str | None = None


class _EndBody(BaseModel):
    pass


class _SessionEndOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session: LearningSessionOut


# --- Helpers -----------------------------------------------------------------


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


# --- POST /start -----------------------------------------------------------


@router.post(
    "/start",
    response_model=_SessionStartOut,
    status_code=status.HTTP_201_CREATED,
)
def start_session(payload: _StartBody, db: Session = Depends(get_db)) -> _SessionStartOut:
    project = _get_project(db, payload.project_id)
    profile = _latest_profile(db, project.id)
    method_key = payload.method.value if payload.method else _pick_initial_method(profile)

    sess = LearningSession(
        project_id=project.id,
        method=method_key,
        cycle_step=payload.cycle_step,
        status="active",
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)

    try:
        prompt = build_prompt(
            project=_project_to_dict(project),
            profile=_profile_to_dict(profile),
            method=method_key,
            step=payload.cycle_step,
            lang=payload.lang,
        )
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc

    return _SessionStartOut(
        session=LearningSessionOut.model_validate(sess),
        system_prompt=prompt,
    )


# --- POST /{id}/message ----------------------------------------------------


@router.post(
    "/{session_id}/message",
    response_model=SessionMessageOut,
    status_code=status.HTTP_201_CREATED,
)
def append_message(
    session_id: str,
    payload: _MessageBody,
    db: Session = Depends(get_db),
) -> SessionMessageOut:
    sess = _get_session(db, session_id)
    if sess.status != "active":
        raise ValidationError(
            f"Session {session_id!r} is {sess.status!r}; cannot append messages "
            f"(reopen by starting a new session)."
        )
    msg = SessionMessage(
        session_id=sess.id,
        role=payload.role.value,
        content=payload.content,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return SessionMessageOut.model_validate(msg)


# --- POST /{id}/rate -------------------------------------------------------


@router.post(
    "/{session_id}/rate",
    response_model=SessionRatingOut,
    status_code=status.HTTP_201_CREATED,
)
def rate_session(
    session_id: str,
    payload: _RatingBody,
    db: Session = Depends(get_db),
) -> SessionRatingOut:
    sess = _get_session(db, session_id)
    rating = SessionRating(
        session_id=sess.id,
        understanding=payload.understanding,
        stress=payload.stress,
        method_fit=payload.method_fit,
        notes=payload.notes,
    )
    db.add(rating)
    db.commit()
    db.refresh(rating)
    return SessionRatingOut.model_validate(rating)


# --- POST /{id}/end --------------------------------------------------------


@router.post("/{session_id}/end", response_model=_SessionEndOut)
def end_session(
    session_id: str,
    _payload: _EndBody | None = None,
    db: Session = Depends(get_db),
) -> _SessionEndOut:
    sess = _get_session(db, session_id)
    if sess.status == "completed":
        # Idempotent: re-ending a closed session is a no-op + returns
        # the existing row. Pre-empts the "user double-clicked end"
        # race the frontend can produce on a slow network.
        return _SessionEndOut(session=LearningSessionOut.model_validate(sess))

    sess.status = "completed"
    sess.ended_at = datetime.now(UTC)
    db.commit()
    db.refresh(sess)

    # Notify the tracking plugin (Phase 3-D) that this session
    # closed; pluggy's list-mode dispatch fans the call out to
    # every subscriber. Errors here MUST NOT roll back the close —
    # the hookspec docstring records that contract.
    latest_rating = (
        db.query(SessionRating)
        .filter(SessionRating.session_id == sess.id)
        .order_by(SessionRating.created_at.desc())
        .first()
    )
    _fire_on_session_complete(
        session={
            "id": sess.id,
            "project_id": sess.project_id,
            "method": sess.method,
            "cycle_step": sess.cycle_step,
            "started_at": sess.started_at.isoformat() if sess.started_at else None,
            "ended_at": sess.ended_at.isoformat() if sess.ended_at else None,
            "status": sess.status,
        },
        rating={
            "understanding": latest_rating.understanding if latest_rating else None,
            "stress": latest_rating.stress if latest_rating else None,
            "method_fit": latest_rating.method_fit if latest_rating else None,
            "notes": latest_rating.notes if latest_rating else None,
        }
        if latest_rating
        else {},
    )

    return _SessionEndOut(session=LearningSessionOut.model_validate(sess))


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
        import logging

        logging.getLogger(__name__).warning(
            "on_session_complete subscriber raised; session close not affected",
            exc_info=True,
        )
