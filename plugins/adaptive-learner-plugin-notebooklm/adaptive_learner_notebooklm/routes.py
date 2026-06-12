"""FastAPI routes for the NotebookLM plugin (Phase 32).

  GET    /api/plugins/notebooklm/questions/{user_id}                list
  POST   /api/plugins/notebooklm/questions?user_id={u}               manual insert
  PATCH  /api/plugins/notebooklm/questions/{id}                      inline edit
  DELETE /api/plugins/notebooklm/questions/{id}                      delete
  POST   /api/plugins/notebooklm/questions/generate/session/{id}     AI extract from session
  POST   /api/plugins/notebooklm/questions/generate/project/{id}     AI extract from project
  POST   /api/plugins/notebooklm/study-guide/{project_id}            AI study-guide Markdown
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError, ValidationError
from app.models import StudyQuestion, User
from app.schemas import (
    StudyQuestionCreate,
    StudyQuestionOut,
    StudyQuestionUpdate,
)
from app.services.ai_caller import build_ai_caller

from . import question_generator, study_guide_generator

router = APIRouter(prefix="/plugins/notebooklm", tags=["notebooklm"])
logger = logging.getLogger(__name__)


_ALLOWED_TYPES = {"open", "fill_blank", "explain", "compare"}
_ALLOWED_DIFFICULTIES = {"easy", "medium", "hard"}


def _to_out(row: StudyQuestion) -> StudyQuestionOut:
    return StudyQuestionOut.model_validate(row)


def _ensure_user(db: Session, user_id: str) -> None:
    if db.get(User, user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")


def _get_question(db: Session, qid: str) -> StudyQuestion:
    row = db.get(StudyQuestion, qid)
    if row is None:
        raise NotFoundError(f"StudyQuestion {qid!r} not found.")
    return row


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.get(
    "/questions/{user_id}", response_model=list[StudyQuestionOut]
)
def list_questions(
    user_id: str,
    project_id: str | None = None,
    difficulty: str | None = None,
    topic: str | None = None,
    db: Session = Depends(get_db),
) -> list[StudyQuestionOut]:
    """Filterable list for the Progress > Study Questions UI."""
    _ensure_user(db, user_id)
    q = db.query(StudyQuestion).filter(StudyQuestion.user_id == user_id)
    if project_id is not None:
        q = q.filter(StudyQuestion.project_id == project_id)
    if difficulty is not None:
        if difficulty not in _ALLOWED_DIFFICULTIES:
            raise ValidationError(
                f"difficulty must be one of {sorted(_ALLOWED_DIFFICULTIES)}."
            )
        q = q.filter(StudyQuestion.difficulty == difficulty)
    if topic is not None:
        # Case-insensitive substring match — ``topic`` is a short
        # free-text tag so an exact match is too brittle.
        q = q.filter(StudyQuestion.topic.ilike(f"%{topic}%"))
    rows = q.order_by(StudyQuestion.created_at.desc()).all()
    return [_to_out(r) for r in rows]


@router.post("/questions", response_model=StudyQuestionOut)
def create_question(
    body: StudyQuestionCreate,
    user_id: str,
    db: Session = Depends(get_db),
) -> StudyQuestionOut:
    """Manual insert (when the user wants to author their own
    question rather than running the AI generator)."""
    _ensure_user(db, user_id)
    if body.question_type not in _ALLOWED_TYPES:
        raise ValidationError(
            f"question_type must be one of {sorted(_ALLOWED_TYPES)}."
        )
    if body.difficulty not in _ALLOWED_DIFFICULTIES:
        raise ValidationError(
            f"difficulty must be one of {sorted(_ALLOWED_DIFFICULTIES)}."
        )
    row = StudyQuestion(
        user_id=user_id,
        project_id=body.project_id,
        session_id=body.session_id,
        question=body.question,
        expected_answer=body.expected_answer,
        question_type=body.question_type,
        difficulty=body.difficulty,
        topic=body.topic,
        edited=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.patch(
    "/questions/{qid}", response_model=StudyQuestionOut
)
def update_question(
    qid: str,
    body: StudyQuestionUpdate,
    db: Session = Depends(get_db),
) -> StudyQuestionOut:
    """Inline edit. Touching ``question`` or ``expected_answer``
    flips ``edited=True`` so a future re-generation skips this
    row."""
    row = _get_question(db, qid)
    text_changed = False
    if body.question is not None:
        row.question = body.question
        text_changed = True
    if body.expected_answer is not None:
        row.expected_answer = body.expected_answer
        text_changed = True
    if body.question_type is not None:
        if body.question_type not in _ALLOWED_TYPES:
            raise ValidationError(
                f"question_type must be one of {sorted(_ALLOWED_TYPES)}."
            )
        row.question_type = body.question_type
    if body.difficulty is not None:
        if body.difficulty not in _ALLOWED_DIFFICULTIES:
            raise ValidationError(
                f"difficulty must be one of {sorted(_ALLOWED_DIFFICULTIES)}."
            )
        row.difficulty = body.difficulty
    if body.topic is not None:
        row.topic = body.topic
    if text_changed:
        row.edited = True
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.delete("/questions/{qid}")
def delete_question(
    qid: str, db: Session = Depends(get_db)
) -> dict[str, Any]:
    row = _get_question(db, qid)
    db.delete(row)
    db.commit()
    return {"deleted": qid}


# ---------------------------------------------------------------------------
# AI generators
# ---------------------------------------------------------------------------


@router.post(
    "/questions/generate/session/{session_id}",
    response_model=list[StudyQuestionOut],
)
def generate_from_session(
    session_id: str, db: Session = Depends(get_db)
) -> list[StudyQuestionOut]:
    """Generate study questions from a completed session's
    transcript. Returns the inserted rows (empty list on
    AI/parse failure — non-fatal)."""
    transcript, user_id, _ = question_generator.session_transcript(
        db, session_id
    )
    if user_id is None:
        raise NotFoundError(f"LearningSession {session_id!r} not found.")
    if not transcript.strip():
        return []
    ai_call = build_ai_caller(db, user_id, max_tokens=1024)
    rows = question_generator.generate_from_session(
        db, session_id, ai_call
    )
    return [_to_out(r) for r in rows]


@router.post(
    "/questions/generate/project/{project_id}",
    response_model=list[StudyQuestionOut],
)
def generate_from_project(
    project_id: str, db: Session = Depends(get_db)
) -> list[StudyQuestionOut]:
    """Generate study questions across the project's recent
    sessions in aggregate."""
    transcript, user_id = question_generator.project_transcript(
        db, project_id
    )
    if user_id is None:
        raise NotFoundError(
            f"LearningProject {project_id!r} not found."
        )
    if not transcript.strip():
        return []
    ai_call = build_ai_caller(db, user_id, max_tokens=2048)
    rows = question_generator.generate_from_project(
        db, project_id, ai_call
    )
    return [_to_out(r) for r in rows]


# ---------------------------------------------------------------------------
# Study guide
# ---------------------------------------------------------------------------


@router.post("/study-guide/{project_id}", response_class=PlainTextResponse)
def generate_study_guide(
    project_id: str, db: Session = Depends(get_db)
) -> PlainTextResponse:
    """Produce a comprehensive Markdown study guide for the
    project. One big AI call with content-clipping. Returns
    ``text/markdown; charset=utf-8``."""
    context = study_guide_generator.assemble_project_context(
        db, project_id
    )
    if context is None:
        raise NotFoundError(
            f"LearningProject {project_id!r} not found."
        )
    # Resolve user_id via the project for the AI caller.
    from app.models import LearningProject

    project = db.get(LearningProject, project_id)
    assert project is not None  # NotFoundError already raised above
    ai_call = build_ai_caller(db, project.user_id, max_tokens=4096)
    markdown = study_guide_generator.generate(ai_call, project=context)
    if not markdown:
        raise ValidationError(
            "Could not generate the study guide. Try again."
        )
    return PlainTextResponse(
        content=markdown,
        media_type="text/markdown; charset=utf-8",
    )
