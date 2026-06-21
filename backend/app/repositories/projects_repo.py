"""Repository for the LearningProject aggregate (EXP-024 Phase 1).

Encapsulates project persistence and the user-existence read the
service needs for ownership-scoped 404s. Identity-file side effects and
domain errors stay in ``app.services.projects``.
"""

from __future__ import annotations

from abc import abstractmethod
from collections.abc import Mapping

from sqlalchemy.orm import Session

from app.models import LearningProject, User
from app.repositories.base import Repository


class ProjectsRepository(Repository):
    """Persistence contract for learning projects."""

    @abstractmethod
    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""

    @abstractmethod
    def get_by_id(self, project_id: str) -> LearningProject | None:
        """Return the project row, or ``None`` when it does not exist."""

    @abstractmethod
    def create(
        self,
        *,
        user_id: str,
        topic: str,
        goal: str | None,
        timeframe: str | None,
        daily_minutes: int | None,
        current_problem: str | None,
        active: bool,
    ) -> LearningProject:
        """Insert a project and return it."""

    @abstractmethod
    def list_by_user(self, user_id: str) -> list[LearningProject]:
        """Return the user's projects, newest first."""

    @abstractmethod
    def apply_update(
        self, project: LearningProject, fields: Mapping[str, object]
    ) -> LearningProject:
        """Set the given attributes, persist, and return the row."""


class SqlAlchemyProjectsRepository(ProjectsRepository):
    """SQLAlchemy-backed :class:`ProjectsRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""
        return self._db.get(User, user_id)

    def get_by_id(self, project_id: str) -> LearningProject | None:
        """Return the project row, or ``None`` when it does not exist."""
        return self._db.get(LearningProject, project_id)

    def create(
        self,
        *,
        user_id: str,
        topic: str,
        goal: str | None,
        timeframe: str | None,
        daily_minutes: int | None,
        current_problem: str | None,
        active: bool,
    ) -> LearningProject:
        """Insert a project and return the committed row."""
        project = LearningProject(
            user_id=user_id,
            topic=topic,
            goal=goal,
            timeframe=timeframe,
            daily_minutes=daily_minutes,
            current_problem=current_problem,
            active=active,
        )
        self._db.add(project)
        self._db.commit()
        self._db.refresh(project)
        return project

    def list_by_user(self, user_id: str) -> list[LearningProject]:
        """Return the user's projects, newest first."""
        return (
            self._db.query(LearningProject)
            .filter(LearningProject.user_id == user_id)
            .order_by(LearningProject.created_at.desc())
            .all()
        )

    def apply_update(
        self, project: LearningProject, fields: Mapping[str, object]
    ) -> LearningProject:
        """Set the given attributes, persist, and return the project."""
        for key, value in fields.items():
            setattr(project, key, value)
        self._db.commit()
        self._db.refresh(project)
        return project


__all__ = ["ProjectsRepository", "SqlAlchemyProjectsRepository"]
