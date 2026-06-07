"""LearningProject CRUD service (Phase 1C-C; EXP-024 repository migration).

Same shape as :mod:`app.services.users`: business-layer functions that
validate, raise :class:`AdaptiveLearnerError` subclasses, and
orchestrate the identity-file side effect. Persistence goes through
:class:`ProjectsRepository`; the service never touches SQLAlchemy.
"""

from __future__ import annotations

from app.exceptions import NotFoundError
from app.models import LearningProject
from app.repositories.projects_repo import ProjectsRepository
from app.schemas import LearningProjectCreateBody, LearningProjectUpdate
from app.services import identity_service


def create_project(
    repo: ProjectsRepository, user_id: str, payload: LearningProjectCreateBody
) -> LearningProject:
    """Insert a project owned by ``user_id``.

    The user id comes from the route prefix; the body schema
    (:class:`LearningProjectCreateBody`) deliberately omits it so
    a client cannot forge a cross-user write through the API.
    Raises :class:`NotFoundError` when the user does not exist.
    """
    if repo.get_user(user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    project = repo.create(
        user_id=user_id,
        topic=payload.topic,
        goal=payload.goal,
        timeframe=payload.timeframe,
        daily_minutes=payload.daily_minutes,
        current_problem=payload.current_problem,
        active=payload.active,
    )
    # Phase 41A: the freshly created project is by default what the
    # user is now working on - persist it as active_project_id so a
    # recovery after browser wipe lands on the right dashboard.
    identity_service.update_identity(user_id=user_id, project_id=project.id)
    return project


def list_projects(repo: ProjectsRepository, user_id: str) -> list[LearningProject]:
    """All projects owned by ``user_id``, newest first.

    Raises :class:`NotFoundError` when the user does not exist so a
    GET ``/users/{stale_id}/projects`` returns 404 instead of an
    empty list (which would mask a stale client cache).
    """
    if repo.get_user(user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    return repo.list_by_user(user_id)


def get_project(repo: ProjectsRepository, project_id: str) -> LearningProject:
    project = repo.get_by_id(project_id)
    if project is None:
        raise NotFoundError(f"LearningProject {project_id!r} not found.")
    return project


def update_project(
    repo: ProjectsRepository, project_id: str, payload: LearningProjectUpdate
) -> LearningProject:
    """Partial update; only fields the client set are written."""
    project = get_project(repo, project_id)
    fields = payload.model_dump(exclude_unset=True)
    project = repo.apply_update(project, fields)
    # Phase 41A: an active=True flip is the project-switch signal -
    # refresh identity.yaml's active_project_id so post-wipe recovery
    # lands on the project the user actually picked last.
    if fields.get("active") is True:
        identity_service.update_identity(user_id=project.user_id, project_id=project.id)
    return project


__all__ = ["create_project", "get_project", "list_projects", "update_project"]
