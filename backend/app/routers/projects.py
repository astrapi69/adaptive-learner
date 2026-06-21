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

from app.deps import get_projects_repo
from app.repositories.projects_repo import ProjectsRepository
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
    repo: ProjectsRepository = Depends(get_projects_repo),
) -> LearningProjectOut:
    """Create a learning project for the given user."""
    return LearningProjectOut.model_validate(
        projects_service.create_project(repo, user_id, payload)
    )


@users_projects_router.get(
    "/{user_id}/projects",
    response_model=list[LearningProjectOut],
)
def list_projects(
    user_id: str, repo: ProjectsRepository = Depends(get_projects_repo)
) -> list[LearningProjectOut]:
    """List all learning projects belonging to the given user."""
    return [
        LearningProjectOut.model_validate(p) for p in projects_service.list_projects(repo, user_id)
    ]


# --- /projects/{project_id} -------------------------------------------------

projects_router = APIRouter(prefix="/projects", tags=["projects"])


@projects_router.get("/{project_id}", response_model=LearningProjectOut)
def get_project(
    project_id: str, repo: ProjectsRepository = Depends(get_projects_repo)
) -> LearningProjectOut:
    """Return a single learning project by id (404 if not found)."""
    return LearningProjectOut.model_validate(projects_service.get_project(repo, project_id))


@projects_router.patch("/{project_id}", response_model=LearningProjectOut)
def update_project(
    project_id: str,
    payload: LearningProjectUpdate,
    repo: ProjectsRepository = Depends(get_projects_repo),
) -> LearningProjectOut:
    """Partially update a learning project (404 if not found)."""
    return LearningProjectOut.model_validate(
        projects_service.update_project(repo, project_id, payload)
    )
