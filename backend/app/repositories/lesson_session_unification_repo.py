"""Repository for the lesson-completion unification writes
(Phase 46F; EXP-024 Phase 1).

Owns the content pseudo-project lookup/insert and the completed
LearningSession insert. The find-or-create policy, the hook fire, and
the pseudo-project field defaults live in
``app.services.lesson_session_unification``.
"""

from __future__ import annotations

from abc import abstractmethod
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import (
    LEARNING_PROJECT_KIND_CONTENT,
    LearningProject,
    LearningSession,
)
from app.repositories.base import Repository


class LessonSessionUnificationRepository(Repository):
    """Persistence contract for the lesson-completion unification path."""

    @abstractmethod
    def get_content_pseudo_project(self, user_id: str) -> LearningProject | None:
        """Return the user's ``kind='content'`` pseudo-project, if any."""

    @abstractmethod
    def create_pseudo_project(
        self,
        *,
        user_id: str,
        topic: str,
        goal: str,
        timeframe: str,
        daily_minutes: int,
    ) -> LearningProject:
        """Insert the content pseudo-project and flush (no commit).

        The caller commits as part of the completion transaction; the
        flush makes the new id visible immediately.
        """

    @abstractmethod
    def create_completed_session(
        self,
        *,
        project_id: str,
        method: str,
        started_at: datetime,
        ended_at: datetime,
        cycle_step: int,
        status: str,
    ) -> LearningSession:
        """Insert a completed LearningSession, commit, and return it."""


class SqlAlchemyLessonSessionUnificationRepository(LessonSessionUnificationRepository):
    """SQLAlchemy-backed :class:`LessonSessionUnificationRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_content_pseudo_project(self, user_id: str) -> LearningProject | None:
        return (
            self._db.query(LearningProject)
            .filter(
                LearningProject.user_id == user_id,
                LearningProject.kind == LEARNING_PROJECT_KIND_CONTENT,
            )
            .one_or_none()
        )

    def create_pseudo_project(
        self,
        *,
        user_id: str,
        topic: str,
        goal: str,
        timeframe: str,
        daily_minutes: int,
    ) -> LearningProject:
        proj = LearningProject(
            user_id=user_id,
            topic=topic,
            goal=goal,
            timeframe=timeframe,
            daily_minutes=daily_minutes,
            kind=LEARNING_PROJECT_KIND_CONTENT,
            active=True,
        )
        self._db.add(proj)
        self._db.flush()
        return proj

    def create_completed_session(
        self,
        *,
        project_id: str,
        method: str,
        started_at: datetime,
        ended_at: datetime,
        cycle_step: int,
        status: str,
    ) -> LearningSession:
        sess = LearningSession(
            project_id=project_id,
            method=method,
            started_at=started_at,
            ended_at=ended_at,
            cycle_step=cycle_step,
            status=status,
        )
        self._db.add(sess)
        self._db.commit()
        self._db.refresh(sess)
        return sess


__all__ = [
    "LessonSessionUnificationRepository",
    "SqlAlchemyLessonSessionUnificationRepository",
]
