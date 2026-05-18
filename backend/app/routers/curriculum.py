"""Curriculum + LearningTopic routers (Phase 5-E).

  POST   /api/users/{user_id}/curricula                  -> 201 CurriculumOut
  GET    /api/users/{user_id}/curricula                  -> list[CurriculumOut]
  GET    /api/curricula/{curriculum_id}                  -> CurriculumOut
  PATCH  /api/curricula/{curriculum_id}                  -> CurriculumOut
  DELETE /api/curricula/{curriculum_id}                  -> 204
  GET    /api/curricula/{curriculum_id}/topics           -> list[LearningTopicOut]
  POST   /api/curricula/{curriculum_id}/topics           -> 201 LearningTopicOut
  GET    /api/topics/{topic_id}                          -> LearningTopicOut
  PATCH  /api/topics/{topic_id}                          -> LearningTopicOut
  DELETE /api/topics/{topic_id}                          -> 204

Topics are returned as a flat list (ordered by order_index then
created_at). The frontend rebuilds the tree client-side via the
``buildTreeFromFlat`` helper from the TypedTreeNode adapter; this
keeps the wire shape simple and lets the server stay stateless
about depth limits / paging strategies.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    CurriculumOut,
    CurriculumUpdate,
    LearningTopicOut,
    LearningTopicUpdate,
    LessonOut,
    LessonUpdate,
)
from app.services import curriculum as curriculum_service

# --- Body schemas (router-local) ------------------------------------------


class _CurriculumCreateBody(BaseModel):
    """POST body for the user-scoped /curricula route. ``user_id``
    comes from the path; including it in the body would let a
    client forge cross-user writes."""

    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    language: str = Field(default="de", max_length=10)


class _TopicCreateBody(BaseModel):
    """POST body for /curricula/{id}/topics. Same forge-prevention
    rationale: curriculum_id is path-derived."""

    parent_id: str | None = None
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    order_index: int = Field(default=0, ge=0)


class _LessonCreateBody(BaseModel):
    """POST body for /curricula/{id}/lessons. Curriculum is path-
    derived (forge prevention). ``content`` defaults to empty so
    a learner can create the lesson header first and fill the
    body later via PATCH."""

    title: str = Field(min_length=1, max_length=500)
    content: str = ""
    order_index: int = Field(default=0, ge=0)


# --- Routers ---------------------------------------------------------------


users_curricula_router = APIRouter(prefix="/users", tags=["curriculum"])
curricula_router = APIRouter(prefix="/curricula", tags=["curriculum"])
topics_router = APIRouter(prefix="/topics", tags=["curriculum"])
lessons_router = APIRouter(prefix="/lessons", tags=["curriculum"])


# --- /users/{user_id}/curricula -------------------------------------------


@users_curricula_router.post(
    "/{user_id}/curricula",
    response_model=CurriculumOut,
    status_code=status.HTTP_201_CREATED,
)
def create_curriculum(
    user_id: str,
    payload: _CurriculumCreateBody,
    db: Session = Depends(get_db),
) -> CurriculumOut:
    from app.schemas import CurriculumCreate

    create_payload = CurriculumCreate(user_id=user_id, **payload.model_dump())
    return CurriculumOut.model_validate(curriculum_service.create_curriculum(db, create_payload))


@users_curricula_router.get(
    "/{user_id}/curricula",
    response_model=list[CurriculumOut],
)
def list_curricula(user_id: str, db: Session = Depends(get_db)) -> list[CurriculumOut]:
    return [
        CurriculumOut.model_validate(c)
        for c in curriculum_service.list_curriculums_for_user(db, user_id)
    ]


# --- /curricula/{id} ------------------------------------------------------


@curricula_router.get("/{curriculum_id}", response_model=CurriculumOut)
def get_curriculum(curriculum_id: str, db: Session = Depends(get_db)) -> CurriculumOut:
    return CurriculumOut.model_validate(curriculum_service.get_curriculum(db, curriculum_id))


@curricula_router.patch("/{curriculum_id}", response_model=CurriculumOut)
def update_curriculum(
    curriculum_id: str,
    payload: CurriculumUpdate,
    db: Session = Depends(get_db),
) -> CurriculumOut:
    return CurriculumOut.model_validate(
        curriculum_service.update_curriculum(db, curriculum_id, payload)
    )


@curricula_router.delete("/{curriculum_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_curriculum(curriculum_id: str, db: Session = Depends(get_db)) -> Response:
    curriculum_service.delete_curriculum(db, curriculum_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- /curricula/{id}/topics -----------------------------------------------


@curricula_router.get(
    "/{curriculum_id}/topics",
    response_model=list[LearningTopicOut],
)
def list_topics(curriculum_id: str, db: Session = Depends(get_db)) -> list[LearningTopicOut]:
    return [
        LearningTopicOut.model_validate(t)
        for t in curriculum_service.list_topics(db, curriculum_id)
    ]


@curricula_router.post(
    "/{curriculum_id}/topics",
    response_model=LearningTopicOut,
    status_code=status.HTTP_201_CREATED,
)
def create_topic(
    curriculum_id: str,
    payload: _TopicCreateBody,
    db: Session = Depends(get_db),
) -> LearningTopicOut:
    from app.schemas import LearningTopicCreate

    create_payload = LearningTopicCreate(curriculum_id=curriculum_id, **payload.model_dump())
    return LearningTopicOut.model_validate(curriculum_service.create_topic(db, create_payload))


# --- /curricula/{id}/lessons ----------------------------------------------


@curricula_router.get(
    "/{curriculum_id}/lessons",
    response_model=list[LessonOut],
)
def list_lessons(curriculum_id: str, db: Session = Depends(get_db)) -> list[LessonOut]:
    return [LessonOut.model_validate(l) for l in curriculum_service.list_lessons(db, curriculum_id)]


@curricula_router.post(
    "/{curriculum_id}/lessons",
    response_model=LessonOut,
    status_code=status.HTTP_201_CREATED,
)
def create_lesson(
    curriculum_id: str,
    payload: _LessonCreateBody,
    db: Session = Depends(get_db),
) -> LessonOut:
    from app.schemas import LessonCreate

    create_payload = LessonCreate(curriculum_id=curriculum_id, **payload.model_dump())
    return LessonOut.model_validate(curriculum_service.create_lesson(db, create_payload))


# --- /topics/{id} ----------------------------------------------------------


@topics_router.get("/{topic_id}", response_model=LearningTopicOut)
def get_topic(topic_id: str, db: Session = Depends(get_db)) -> LearningTopicOut:
    return LearningTopicOut.model_validate(curriculum_service.get_topic(db, topic_id))


@topics_router.patch("/{topic_id}", response_model=LearningTopicOut)
def update_topic(
    topic_id: str,
    payload: LearningTopicUpdate,
    db: Session = Depends(get_db),
) -> LearningTopicOut:
    return LearningTopicOut.model_validate(curriculum_service.update_topic(db, topic_id, payload))


@topics_router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(topic_id: str, db: Session = Depends(get_db)) -> Response:
    curriculum_service.delete_topic(db, topic_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- /lessons/{id} --------------------------------------------------------


@lessons_router.get("/{lesson_id}", response_model=LessonOut)
def get_lesson(lesson_id: str, db: Session = Depends(get_db)) -> LessonOut:
    return LessonOut.model_validate(curriculum_service.get_lesson(db, lesson_id))


@lessons_router.patch("/{lesson_id}", response_model=LessonOut)
def update_lesson(
    lesson_id: str,
    payload: LessonUpdate,
    db: Session = Depends(get_db),
) -> LessonOut:
    return LessonOut.model_validate(curriculum_service.update_lesson(db, lesson_id, payload))


@lessons_router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(lesson_id: str, db: Session = Depends(get_db)) -> Response:
    curriculum_service.delete_lesson(db, lesson_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
