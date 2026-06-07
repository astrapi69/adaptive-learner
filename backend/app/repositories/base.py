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
