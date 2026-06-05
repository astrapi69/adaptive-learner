"""Lesson-progress router (Phase 44 / EXP-002 / P-109).

  GET   /api/users/{user_id}/lesson-progress                → list
  GET   /api/users/{user_id}/lesson-progress/{src}/{set}/{lesson}
                                                            → one or 404
  POST  /api/users/{user_id}/lesson-progress                → upsert

Routes mirror the canonical /users/{user_id}/* shape (used
by the existing /imports and /projects routes). Source slug
uses ``owner--name`` (slash → ``--``) so the path stays flat.

Per the architecture rule, routes are thin: validate +
delegate to the service. The service handles JSON-encoding
of ``step_results`` so the wire shape is always a parsed
dict.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError
from app.schemas import LessonProgressOut, LessonProgressUpsert
from app.services import lesson_progress as lesson_progress_service

router = APIRouter(prefix="/users", tags=["lesson-progress"])


def _unslug(source_slug: str) -> str:
    return source_slug.replace("--", "/")


@router.get(
    "/{user_id}/lesson-progress",
    response_model=list[LessonProgressOut],
)
def list_lesson_progress(
    user_id: str,
    db: Session = Depends(get_db),
) -> list[LessonProgressOut]:
    rows = lesson_progress_service.list_progress(db, user_id)
    return [LessonProgressOut.model_validate(row) for row in rows]


@router.get(
    "/{user_id}/lesson-progress/{source_slug}/{set_id}/{lesson_filename}",
    response_model=LessonProgressOut,
)
def get_lesson_progress(
    user_id: str,
    source_slug: str,
    set_id: str,
    lesson_filename: str,
    db: Session = Depends(get_db),
) -> LessonProgressOut:
    row = lesson_progress_service.get_progress(
        db,
        user_id,
        source=_unslug(source_slug),
        set_id=set_id,
        lesson_filename=lesson_filename,
    )
    if row is None:
        raise NotFoundError(
            f"No progress for {_unslug(source_slug)}/{set_id}/{lesson_filename}",
        )
    return LessonProgressOut.model_validate(row)


@router.post(
    "/{user_id}/lesson-progress",
    response_model=LessonProgressOut,
)
def upsert_lesson_progress(
    user_id: str,
    payload: LessonProgressUpsert,
    db: Session = Depends(get_db),
) -> LessonProgressOut:
    step_result = payload.step_result.model_dump() if payload.step_result is not None else None
    row = lesson_progress_service.upsert_progress(
        db,
        user_id,
        source=payload.source,
        set_id=payload.set_id,
        lesson_filename=payload.lesson_filename,
        step_result=step_result,
        time_spent_seconds_delta=payload.time_spent_seconds_delta,
        current_step=payload.current_step,
        mark_completed=payload.mark_completed,
        mark_paused=payload.mark_paused,
        mark_abandoned=payload.mark_abandoned,
        mark_resumed=payload.mark_resumed,
        mark_restarted=payload.mark_restarted,
    )
    return LessonProgressOut.model_validate(row)
