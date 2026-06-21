"""Repository for the ElementError aggregate (Phase 46B/C; EXP-024 Phase 1).

Owns the persistence primitives for per-element error tracking. The
upsert transition matrix and mastery rules live in
``app.services.element_errors``; this layer only finds, inserts, and
lists rows, plus the explicit transaction controls the bulk-upsert
route relies on (the service flushes per attempt; the caller commits
the batch atomically).
"""

from __future__ import annotations

from abc import abstractmethod

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ElementError, User
from app.repositories.base import Repository


class ElementErrorsRepository(Repository):
    """Persistence contract for element-error rows."""

    @abstractmethod
    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""

    @abstractmethod
    def find(
        self,
        *,
        user_id: str,
        set_id: str,
        lesson_id: str,
        exercise_id: str,
        element_key: str,
        direction: str,
    ) -> ElementError | None:
        """Return the row for the composite key, or ``None``."""

    @abstractmethod
    def add(self, row: ElementError) -> None:
        """Stage a new row for insertion (no flush/commit)."""

    @abstractmethod
    def flush(self) -> None:
        """Flush pending changes so generated ids/state are visible."""

    @abstractmethod
    def commit(self) -> None:
        """Commit the current transaction (the bulk-upsert boundary)."""

    @abstractmethod
    def list_for_user(
        self, user_id: str, *, set_id: str | None = None, include_mastered: bool = True
    ) -> list[ElementError]:
        """Return the user's rows, newest-updated first."""


class SqlAlchemyElementErrorsRepository(ElementErrorsRepository):
    """SQLAlchemy-backed :class:`ElementErrorsRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_user(self, user_id: str) -> User | None:
        """Return the user row by primary key, or ``None`` if absent."""
        return self._db.get(User, user_id)

    def find(
        self,
        *,
        user_id: str,
        set_id: str,
        lesson_id: str,
        exercise_id: str,
        element_key: str,
        direction: str,
    ) -> ElementError | None:
        """Return the row matching the full composite key (including direction), or ``None``.

        Receptive and productive rows for the same card are distinct
        identities (EXP-018 / Phase 62); the direction is part of the key.
        """
        stmt = select(ElementError).where(
            ElementError.user_id == user_id,
            ElementError.set_id == set_id,
            ElementError.lesson_id == lesson_id,
            ElementError.exercise_id == exercise_id,
            ElementError.element_key == element_key,
            # EXP-018 / Phase 62: a card's receptive and productive
            # rows are distinct identities; never collapse them.
            ElementError.direction == direction,
        )
        return self._db.execute(stmt).scalar_one_or_none()

    def add(self, row: ElementError) -> None:
        """Stage a new element-error row for insertion (no flush/commit)."""
        self._db.add(row)

    def flush(self) -> None:
        """Flush pending changes so generated ids/state become visible."""
        self._db.flush()

    def commit(self) -> None:
        """Commit the current transaction (the bulk-upsert boundary)."""
        self._db.commit()

    def list_for_user(
        self, user_id: str, *, set_id: str | None = None, include_mastered: bool = True
    ) -> list[ElementError]:
        """Return the user's rows newest-updated first.

        Optionally narrow to a single ``set_id`` and exclude mastered rows
        when ``include_mastered`` is ``False``.
        """
        stmt = select(ElementError).where(ElementError.user_id == user_id)
        if set_id is not None:
            stmt = stmt.where(ElementError.set_id == set_id)
        if not include_mastered:
            stmt = stmt.where(ElementError.mastered.is_(False))
        stmt = stmt.order_by(ElementError.updated_at.desc())
        return list(self._db.execute(stmt).scalars().all())


__all__ = ["ElementErrorsRepository", "SqlAlchemyElementErrorsRepository"]
