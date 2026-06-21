"""Repository for the LessonProgress aggregate (Phase 44; EXP-024 Phase 1).

Owns find/insert/list + the explicit flush/commit/refresh the upsert
needs. The step-result merge, score recompute, and lifecycle transition
matrix live in ``app.services.lesson_progress``; this layer only
persists.
"""

from __future__ import annotations

from abc import abstractmethod

from sqlalchemy.orm import Session

from app.models import LessonProgress, User
from app.repositories.base import Repository


class LessonProgressRepository(Repository):
    """Persistence contract for lesson-progress rows."""

    @abstractmethod
    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""

    @abstractmethod
    def find(
        self, *, user_id: str, source: str, set_id: str, lesson_filename: str
    ) -> LessonProgress | None:
        """Return the row for the composite key, or ``None``."""

    @abstractmethod
    def list_for_user(self, user_id: str) -> list[LessonProgress]:
        """Return the user's rows, newest-updated first."""

    @abstractmethod
    def add(self, row: LessonProgress) -> None:
        """Stage a new row for insertion (no flush/commit)."""

    @abstractmethod
    def flush(self) -> None:
        """Flush pending changes so the new id is visible."""

    @abstractmethod
    def commit(self) -> None:
        """Commit the current transaction."""

    @abstractmethod
    def refresh(self, row: LessonProgress) -> None:
        """Refresh the row from the database after commit."""


class SqlAlchemyLessonProgressRepository(LessonProgressRepository):
    """SQLAlchemy-backed :class:`LessonProgressRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""
        return self._db.get(User, user_id)

    def find(
        self, *, user_id: str, source: str, set_id: str, lesson_filename: str
    ) -> LessonProgress | None:
        """Return the row for the composite key, or ``None`` when absent."""
        return (
            self._db.query(LessonProgress)
            .filter(
                LessonProgress.user_id == user_id,
                LessonProgress.source == source,
                LessonProgress.set_id == set_id,
                LessonProgress.lesson_filename == lesson_filename,
            )
            .one_or_none()
        )

    def list_for_user(self, user_id: str) -> list[LessonProgress]:
        """Return the user's rows, newest-updated first."""
        return (
            self._db.query(LessonProgress)
            .filter(LessonProgress.user_id == user_id)
            .order_by(LessonProgress.updated_at.desc())
            .all()
        )

    def add(self, row: LessonProgress) -> None:
        """Stage a new row for insertion (no flush/commit)."""
        self._db.add(row)

    def flush(self) -> None:
        """Flush pending changes so the new id is visible."""
        self._db.flush()

    def commit(self) -> None:
        """Commit the current transaction."""
        self._db.commit()

    def refresh(self, row: LessonProgress) -> None:
        """Refresh the row from the database after commit."""
        self._db.refresh(row)


__all__ = ["LessonProgressRepository", "SqlAlchemyLessonProgressRepository"]
