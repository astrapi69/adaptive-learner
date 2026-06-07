"""User CRUD service (Phase 1C-B; EXP-024 repository migration).

Business layer: validates, maps backend-neutral repository signals to
domain errors (:class:`AdaptiveLearnerError` subclasses, never
``HTTPException`` -- that's the global handler's job in
:mod:`app.main`), and orchestrates the identity-file side effect.
Persistence goes through :class:`UsersRepository`.
"""

from __future__ import annotations

from app.exceptions import ConflictError, NotFoundError
from app.models import User
from app.repositories.base import UniqueViolationError
from app.repositories.users_repo import UsersRepository
from app.schemas import UserCreate, UserUpdate
from app.services import identity_service


def create_user(repo: UsersRepository, payload: UserCreate) -> User:
    """Insert a new user.

    Raises :class:`ConflictError` when the email collides with an
    existing row.
    """
    try:
        user = repo.create(name=payload.name, email=payload.email, language=payload.language)
    except UniqueViolationError as exc:
        raise ConflictError(f"User with email {payload.email!r} already exists.") from exc
    # Phase 41A: persist identity to ~/.config/adaptive_learner/identity.yaml
    # so a future browser-data-wipe can recover the user_id + language.
    # Best-effort; identity_service swallows OS-level write errors.
    identity_service.update_identity(user_id=user.id, language=user.language)
    return user


def get_user(repo: UsersRepository, user_id: str) -> User:
    """Fetch by id; raises :class:`NotFoundError` when missing."""
    user = repo.get_by_id(user_id)
    if user is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    return user


def update_user(repo: UsersRepository, user_id: str, payload: UserUpdate) -> User:
    """Partial update.

    Only fields the client explicitly set (``model_dump(exclude_unset=
    True)``) are written, so a PATCH that omits ``language`` leaves
    the stored language alone.
    """
    user = get_user(repo, user_id)
    fields = payload.model_dump(exclude_unset=True)
    try:
        user = repo.update_fields(user, fields)
    except UniqueViolationError as exc:
        new_email = fields.get("email")
        raise ConflictError(f"User with email {new_email!r} already exists.") from exc
    # Phase 41A: a language change must refresh identity.yaml so the
    # recovery flow restores the right locale. Name/email changes
    # also touch last_seen via the merge writer (cheap; identity.yaml
    # remains the authoritative recency timestamp for the recovery
    # surface).
    identity_service.update_identity(user_id=user.id, language=user.language)
    return user


__all__ = ["create_user", "get_user", "update_user"]
