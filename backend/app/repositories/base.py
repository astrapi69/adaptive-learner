"""Data-layer repository contracts.

A repository owns ALL persistence primitives for a domain area
(queries, inserts, updates, deletes, transaction boundaries). The
service layer depends only on these abstract interfaces, never on
SQLAlchemy or the ``Session``, so the persistence backend can change
(SQLite -> Postgres, an in-memory fake in tests) without touching
business logic.

Repositories contain NO business rules, NO validation, and NO HTTP
concepts. They return domain entities (SQLAlchemy models) or ``None``;
raising domain errors (:class:`~app.exceptions.NotFoundError`,
:class:`~app.exceptions.ConflictError`, ...) is the service layer's
job. The ``repositories`` package therefore never imports ``fastapi``
-- the FastAPI dependency providers live in :mod:`app.deps` (the
composition root that is allowed to know both FastAPI and the concrete
implementations).
"""

from __future__ import annotations

from abc import ABC


class Repository(ABC):  # noqa: B024 -- intentional methodless marker base
    """Marker base for all data-layer repositories.

    Concrete repositories subclass a domain-specific abstract interface
    (e.g. ``ImportsRepository``) which in turn subclasses this base.
    The base carries no methods; it documents the contract and gives
    the package a single root type for typing and isinstance checks.
    """


class RepositoryError(Exception):
    """Backend-neutral persistence signal raised by repositories.

    This is NOT a domain error. Domain errors
    (:class:`~app.exceptions.NotFoundError`,
    :class:`~app.exceptions.ConflictError`, ...) are the service
    layer's vocabulary. ``RepositoryError`` lets a repository report a
    persistence-level condition (e.g. a UNIQUE violation) in terms the
    service can handle without importing SQLAlchemy. The SQLAlchemy
    implementations translate driver exceptions into these signals; the
    service maps them onto the appropriate domain error.
    """


class UniqueViolationError(RepositoryError):
    """A UNIQUE / primary-key constraint was violated on write.

    ``column`` carries a best-effort identifier for the offending
    constraint (e.g. ``"users.email"``) so the service can decide which
    domain conflict to raise.
    """

    def __init__(
        self, *, column: str | None = None, message: str = "unique constraint violated"
    ) -> None:
        self.column = column
        super().__init__(message)
