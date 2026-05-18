"""FastAPI routes for the assessment plugin.

  GET  /api/plugins/assessment/questions?lang=de       -> list[dict]
  POST /api/plugins/assessment/evaluate                -> LearningProfileOut
  GET  /api/plugins/assessment/profile/{project_id}    -> LearningProfileOut

The router is mounted by PluginForge via ``BasePlugin.get_routes``;
the ``/api`` prefix comes from the manager's ``mount_routes`` call
in :mod:`app.main`. The plugin's own prefix is
``/plugins/assessment``.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import NotFoundError
from app.models import LearningProfile, LearningProject
from app.schemas import LearningProfileOut

from .profile import calculate_profile
from .questions import questions_for_lang

router = APIRouter(prefix="/plugins/assessment", tags=["assessment"])


class _AnswerIn(BaseModel):
    question_id: str = Field(min_length=1)
    answer_id: str = Field(min_length=1)


class _EvaluateBody(BaseModel):
    project_id: str = Field(min_length=1)
    answers: list[_AnswerIn] = Field(min_length=1)


@router.get("/questions")
def get_questions(lang: str = "de") -> list[dict[str, Any]]:
    """Localised question pack. ``lang`` falls back to EN for any
    code that doesn't start with ``de``."""
    return questions_for_lang(lang)


@router.post(
    "/evaluate",
    response_model=LearningProfileOut,
    status_code=status.HTTP_201_CREATED,
)
def evaluate(payload: _EvaluateBody, db: Session = Depends(get_db)) -> LearningProfileOut:
    """Score the answers, persist a new :class:`LearningProfile`,
    return it.

    Each call writes a NEW profile row with ``version`` =
    ``max(existing_versions) + 1``. The prior rows stay for the
    Phase-3-C session plugin's stagnation-detection history.
    """
    project = db.get(LearningProject, payload.project_id)
    if project is None:
        raise NotFoundError(f"LearningProject {payload.project_id!r} not found.")
    weights = calculate_profile([a.model_dump() for a in payload.answers])
    next_version = (
        db.query(LearningProfile)
        .filter(LearningProfile.project_id == project.id)
        .order_by(LearningProfile.version.desc())
        .first()
    )
    next_v = (next_version.version + 1) if next_version else 1
    row = LearningProfile(
        user_id=project.user_id,
        project_id=project.id,
        deductive=weights["deductive"],
        inductive=weights["inductive"],
        error_based=weights["error_based"],
        dialogic=weights["dialogic"],
        contextual=weights["contextual"],
        ai_adaptive=weights["ai_adaptive"],
        version=next_v,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return LearningProfileOut.model_validate(row)


@router.get("/profile/{project_id}", response_model=LearningProfileOut)
def get_latest_profile(project_id: str, db: Session = Depends(get_db)) -> LearningProfileOut:
    """Latest (highest-``version``) profile for the project.

    404 when the project never went through ``/evaluate``. Callers
    that need the full history should query LearningProfile
    directly via a service helper added in Phase 4.
    """
    if db.get(LearningProject, project_id) is None:
        raise NotFoundError(f"LearningProject {project_id!r} not found.")
    row = (
        db.query(LearningProfile)
        .filter(LearningProfile.project_id == project_id)
        .order_by(LearningProfile.version.desc())
        .first()
    )
    if row is None:
        raise NotFoundError(f"No assessment profile for project {project_id!r} yet.")
    return LearningProfileOut.model_validate(row)
