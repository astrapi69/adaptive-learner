"""Projects router (Phase 1C-C).

Split across two prefixes so URL shape stays close to the project
plan §7:

  POST   /api/users/{user_id}/projects   -> 201 LearningProjectOut
  GET    /api/users/{user_id}/projects   -> list[LearningProjectOut]
  GET    /api/projects/{project_id}      -> LearningProjectOut
  PATCH  /api/projects/{project_id}      -> LearningProjectOut

The user-scoped routes live on ``users_projects_router`` so
mounting in main.py is two ``include_router`` calls instead of
hand-writing full paths on a single router.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    LearningProjectCreateBody,
    LearningProjectOut,
    LearningProjectUpdate,
)
from app.services import projects as projects_service

# --- /users/{user_id}/projects ---------------------------------------------

users_projects_router = APIRouter(prefix="/users", tags=["projects"])


@users_projects_router.post(
    "/{user_id}/projects",
    response_model=LearningProjectOut,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    user_id: str,
    payload: LearningProjectCreateBody,
    db: Session = Depends(get_db),
) -> LearningProjectOut:
    return LearningProjectOut.model_validate(projects_service.create_project(db, user_id, payload))


@users_projects_router.get(
    "/{user_id}/projects",
    response_model=list[LearningProjectOut],
)
def list_projects(user_id: str, db: Session = Depends(get_db)) -> list[LearningProjectOut]:
    return [
        LearningProjectOut.model_validate(p) for p in projects_service.list_projects(db, user_id)
    ]


# --- /projects/{project_id} -------------------------------------------------

projects_router = APIRouter(prefix="/projects", tags=["projects"])


@projects_router.get("/{project_id}", response_model=LearningProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)) -> LearningProjectOut:
    return LearningProjectOut.model_validate(projects_service.get_project(db, project_id))


@projects_router.patch("/{project_id}", response_model=LearningProjectOut)
def update_project(
    project_id: str,
    payload: LearningProjectUpdate,
    db: Session = Depends(get_db),
) -> LearningProjectOut:
    return LearningProjectOut.model_validate(
        projects_service.update_project(db, project_id, payload)
    )
