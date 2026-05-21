"""Subject + Tag CRUD + project-association routers (Phase 22C).

  GET    /api/subjects                            -> list[SubjectOut]
  GET    /api/subjects/{id}                       -> SubjectOut
  POST   /api/subjects                            -> 201 SubjectOut
  PATCH  /api/subjects/{id}                       -> SubjectOut
  DELETE /api/subjects/{id}                       -> 204

  GET    /api/users/{user_id}/tags                -> list[TagOut]
  POST   /api/users/{user_id}/tags                -> 201 TagOut
  PATCH  /api/tags/{id}                           -> TagOut
  DELETE /api/tags/{id}                           -> 204

  GET    /api/projects/{id}/subjects              -> list[SubjectOut]
  POST   /api/projects/{id}/subjects              -> 201 SubjectOut
  DELETE /api/projects/{id}/subjects/{subject_id} -> 204

  GET    /api/projects/{id}/tags                  -> list[TagOut]
  POST   /api/projects/{id}/tags                  -> 201 TagOut
  DELETE /api/projects/{id}/tags/{tag_id}         -> 204

Subjects are GLOBAL (no user-scoping in the URL). Tags are
user-scoped through the path prefix to prevent cross-user
writes from being forged via the body.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    SubjectCreate,
    SubjectOut,
    SubjectUpdate,
    TagCreate,
    TagOut,
    TagUpdate,
)
from app.services import taxonomy as taxonomy_service


subjects_router = APIRouter(prefix="/subjects", tags=["taxonomy"])
tags_router = APIRouter(prefix="/tags", tags=["taxonomy"])
users_tags_router = APIRouter(prefix="/users", tags=["taxonomy"])
projects_taxonomy_router = APIRouter(prefix="/projects", tags=["taxonomy"])


# --- Subject body schemas ---------------------------------------------------


class _AssignSubjectBody(BaseModel):
    subject_id: str


class _AssignTagBody(BaseModel):
    tag_id: str


# --- /subjects --------------------------------------------------------------


@subjects_router.get("", response_model=list[SubjectOut])
def list_subjects(db: Session = Depends(get_db)) -> list[SubjectOut]:
    return [SubjectOut.model_validate(row) for row in taxonomy_service.list_subjects(db)]


@subjects_router.get("/{subject_id}", response_model=SubjectOut)
def get_subject(subject_id: str, db: Session = Depends(get_db)) -> SubjectOut:
    return SubjectOut.model_validate(taxonomy_service.get_subject(db, subject_id))


@subjects_router.post(
    "",
    response_model=SubjectOut,
    status_code=status.HTTP_201_CREATED,
)
def create_subject(
    payload: SubjectCreate, db: Session = Depends(get_db)
) -> SubjectOut:
    return SubjectOut.model_validate(taxonomy_service.create_subject(db, payload))


@subjects_router.patch("/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: str,
    payload: SubjectUpdate,
    db: Session = Depends(get_db),
) -> SubjectOut:
    return SubjectOut.model_validate(
        taxonomy_service.update_subject(db, subject_id, payload)
    )


@subjects_router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(subject_id: str, db: Session = Depends(get_db)) -> Response:
    taxonomy_service.delete_subject(db, subject_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- /users/{user_id}/tags -------------------------------------------------


@users_tags_router.get("/{user_id}/tags", response_model=list[TagOut])
def list_user_tags(user_id: str, db: Session = Depends(get_db)) -> list[TagOut]:
    return [
        TagOut.model_validate(row) for row in taxonomy_service.list_tags_for_user(db, user_id)
    ]


@users_tags_router.post(
    "/{user_id}/tags",
    response_model=TagOut,
    status_code=status.HTTP_201_CREATED,
)
def create_user_tag(
    user_id: str,
    payload: TagCreate,
    db: Session = Depends(get_db),
) -> TagOut:
    return TagOut.model_validate(taxonomy_service.create_tag(db, user_id, payload))


# --- /tags/{tag_id} --------------------------------------------------------


@tags_router.patch("/{tag_id}", response_model=TagOut)
def update_tag(
    tag_id: str,
    payload: TagUpdate,
    db: Session = Depends(get_db),
) -> TagOut:
    return TagOut.model_validate(taxonomy_service.update_tag(db, tag_id, payload))


@tags_router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_id: str, db: Session = Depends(get_db)) -> Response:
    taxonomy_service.delete_tag(db, tag_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- /projects/{project_id}/subjects + /tags -------------------------------


@projects_taxonomy_router.get(
    "/{project_id}/subjects", response_model=list[SubjectOut]
)
def list_project_subjects(
    project_id: str, db: Session = Depends(get_db)
) -> list[SubjectOut]:
    return [
        SubjectOut.model_validate(row)
        for row in taxonomy_service.list_project_subjects(db, project_id)
    ]


@projects_taxonomy_router.post(
    "/{project_id}/subjects",
    response_model=SubjectOut,
    status_code=status.HTTP_201_CREATED,
)
def assign_subject_to_project(
    project_id: str,
    payload: _AssignSubjectBody,
    db: Session = Depends(get_db),
) -> SubjectOut:
    taxonomy_service.assign_subject_to_project(db, project_id, payload.subject_id)
    return SubjectOut.model_validate(
        taxonomy_service.get_subject(db, payload.subject_id)
    )


@projects_taxonomy_router.delete(
    "/{project_id}/subjects/{subject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unassign_subject_from_project(
    project_id: str,
    subject_id: str,
    db: Session = Depends(get_db),
) -> Response:
    taxonomy_service.unassign_subject_from_project(db, project_id, subject_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@projects_taxonomy_router.get(
    "/{project_id}/tags", response_model=list[TagOut]
)
def list_project_tags(
    project_id: str, db: Session = Depends(get_db)
) -> list[TagOut]:
    return [
        TagOut.model_validate(row)
        for row in taxonomy_service.list_project_tags(db, project_id)
    ]


@projects_taxonomy_router.post(
    "/{project_id}/tags",
    response_model=TagOut,
    status_code=status.HTTP_201_CREATED,
)
def assign_tag_to_project(
    project_id: str,
    payload: _AssignTagBody,
    db: Session = Depends(get_db),
) -> TagOut:
    taxonomy_service.assign_tag_to_project(db, project_id, payload.tag_id)
    return TagOut.model_validate(taxonomy_service.get_tag(db, payload.tag_id))


@projects_taxonomy_router.delete(
    "/{project_id}/tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unassign_tag_from_project(
    project_id: str,
    tag_id: str,
    db: Session = Depends(get_db),
) -> Response:
    taxonomy_service.unassign_tag_from_project(db, project_id, tag_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
