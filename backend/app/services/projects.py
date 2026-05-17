"""LearningProject CRUD service (Phase 1C-C).

Same shape as :mod:`app.services.users`: pure DB-facing functions
that raise :class:`AdaptiveLearnerError` subclasses. The router
calls one of these per endpoint and never touches SQLAlchemy
directly.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models import LearningProject, User
from app.schemas import LearningProjectCreateBody, LearningProjectUpdate


def create_project(
    db: Session, user_id: str, payload: LearningProjectCreateBody
) -> LearningProject:
    """Insert a project owned by ``user_id``.

    The user id comes from the route prefix; the body schema
    (:class:`LearningProjectCreateBody`) deliberately omits it so
    a client cannot forge a cross-user write through the API.
    Raises :class:`NotFoundError` when the user does not exist.
    """
    if db.get(User, user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    project = LearningProject(
        user_id=user_id,
        topic=payload.topic,
        goal=payload.goal,
        timeframe=payload.timeframe,
        daily_minutes=payload.daily_minutes,
        current_problem=payload.current_problem,
        active=payload.active,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def list_projects(db: Session, user_id: str) -> list[LearningProject]:
    """All projects owned by ``user_id``, newest first.

    Raises :class:`NotFoundError` when the user does not exist so a
    GET ``/users/{stale_id}/projects`` returns 404 instead of an
    empty list (which would mask a stale client cache).
    """
    if db.get(User, user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    return (
        db.query(LearningProject)
        .filter(LearningProject.user_id == user_id)
        .order_by(LearningProject.created_at.desc())
        .all()
    )


def get_project(db: Session, project_id: str) -> LearningProject:
    project = db.get(LearningProject, project_id)
    if project is None:
        raise NotFoundError(f"LearningProject {project_id!r} not found.")
    return project


def update_project(db: Session, project_id: str, payload: LearningProjectUpdate) -> LearningProject:
    """Partial update; only fields the client set are written."""
    project = get_project(db, project_id)
    fields = payload.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return project


__all__ = ["create_project", "get_project", "list_projects", "update_project"]
