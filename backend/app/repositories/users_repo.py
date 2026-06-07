"""Repository for the User aggregate (EXP-024 Phase 1).

Encapsulates user persistence and translates the driver-level
``IntegrityError`` for the only UNIQUE key on ``users`` (email) into a
backend-neutral :class:`UniqueViolationError`. Identity-file side
effects and domain errors stay in ``app.services.users``.
"""

from __future__ import annotations

from abc import abstractmethod
from collections.abc import Mapping

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import User
from app.repositories.base import Repository, UniqueViolationError


def _is_email_collision(exc: IntegrityError, email: str | None) -> bool:
    """Heuristic: the sqlite UNIQUE-constraint message names the column.

    Good enough for the only unique key on ``users`` (email).
    """
    return bool(email) and "users.email" in str(exc.orig).lower()


class UsersRepository(Repository):
    """Persistence contract for users."""

    @abstractmethod
    def get_by_id(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""

    @abstractmethod
    def create(self, *, name: str, email: str | None, language: str) -> User:
        """Insert a user and return it.

        Raises:
            UniqueViolationError: when the email collides with an
                existing row (``column == "users.email"``).
        """

    @abstractmethod
    def update_fields(self, user: User, fields: Mapping[str, object]) -> User:
        """Apply the given attributes, persist, and return the row.

        Raises:
            UniqueViolationError: when the new email collides.
        """


class SqlAlchemyUsersRepository(UsersRepository):
    """SQLAlchemy-backed :class:`UsersRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_by_id(self, user_id: str) -> User | None:
        return self._db.get(User, user_id)

    def create(self, *, name: str, email: str | None, language: str) -> User:
        user = User(name=name, email=email, language=language)
        self._db.add(user)
        try:
            self._db.commit()
        except IntegrityError as exc:
            self._db.rollback()
            if _is_email_collision(exc, email):
                raise UniqueViolationError(column="users.email") from exc
            raise
        self._db.refresh(user)
        return user

    def update_fields(self, user: User, fields: Mapping[str, object]) -> User:
        for key, value in fields.items():
            setattr(user, key, value)
        try:
            self._db.commit()
        except IntegrityError as exc:
            self._db.rollback()
            new_email = fields.get("email")
            if isinstance(new_email, str) and _is_email_collision(exc, new_email):
                raise UniqueViolationError(column="users.email") from exc
            raise
        self._db.refresh(user)
        return user


__all__ = ["UsersRepository", "SqlAlchemyUsersRepository"]
