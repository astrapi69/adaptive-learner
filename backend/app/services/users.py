"""User CRUD service (Phase 1C-B).

Pure DB-facing functions: take a SQLAlchemy ``Session`` plus a
typed payload, return the ORM row. Raise :class:`AdaptiveLearnerError`
subclasses (never ``HTTPException`` — that's the global handler's
job in :mod:`app.main`).
"""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions import ConflictError, NotFoundError
from app.models import User
from app.schemas import UserCreate, UserUpdate


def _email_collision(exc: IntegrityError, email: str | None) -> bool:
    """Heuristic: the sqlite UNIQUE-constraint message names the
    column. Good enough for the only unique key on ``users`` (email).
    """
    return bool(email) and "users.email" in str(exc.orig).lower()


def create_user(db: Session, payload: UserCreate) -> User:
    """Insert a new user.

    Raises :class:`ConflictError` when the email collides with an
    existing row.
    """
    user = User(name=payload.name, email=payload.email, language=payload.language)
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if _email_collision(exc, payload.email):
            raise ConflictError(f"User with email {payload.email!r} already exists.") from exc
        raise
    db.refresh(user)
    return user


def get_user(db: Session, user_id: str) -> User:
    """Fetch by id; raises :class:`NotFoundError` when missing."""
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    return user


def update_user(db: Session, user_id: str, payload: UserUpdate) -> User:
    """Partial update.

    Only fields the client explicitly set (``model_dump(exclude_unset=
    True)``) are written, so a PATCH that omits ``language`` leaves
    the stored language alone.
    """
    user = get_user(db, user_id)
    fields = payload.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(user, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        new_email = fields.get("email")
        if _email_collision(exc, new_email):
            raise ConflictError(f"User with email {new_email!r} already exists.") from exc
        raise
    db.refresh(user)
    return user


__all__ = ["create_user", "get_user", "update_user"]
