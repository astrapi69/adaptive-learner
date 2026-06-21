"""Repository for sync push/pull/resolve/status persistence
(Phase 21D; EXP-024 Phase 1 — final block).

Owns ONLY the Session primitives the sync orchestration needs. The
conflict-detection, append-only-vs-mutable, timestamp-comparison and
resolution business logic stays in ``app.services.sync_service``, as do
the ``TABLES`` registry, the row (de)serialisers, and ``_scoped_query``
(the shared per-table user-scoping query builder — EXP-024 Option A:
``_scoped_query`` is a data-layer primitive consumed by BOTH this
repository and :class:`~app.repositories.backup_repo.BackupRepository`,
not rebuilt in two places).
"""

from __future__ import annotations

from abc import abstractmethod
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import User
from app.repositories.base import Repository
from app.services.sync_service import TABLES, _scoped_query


class SyncRepository(Repository):
    """Persistence contract for the sync orchestration."""

    @abstractmethod
    def user_exists(self, user_id: str) -> bool:
        """True when the user row exists."""

    @abstractmethod
    def get_by_pk(self, model: type[Any], pk: str) -> Any | None:
        """Primary-key lookup, or ``None``."""

    @abstractmethod
    def add(self, entity: Any) -> None:
        """Stage a new row for insertion."""

    @abstractmethod
    def flush(self) -> None:
        """Flush pending changes without committing."""

    @abstractmethod
    def commit(self) -> None:
        """Commit the current transaction."""

    @abstractmethod
    def scoped_rows_since(self, table: str, user_id: str, since: datetime | None) -> list[Any]:
        """User-scoped rows of ``table`` whose timestamp is greater than
        ``since`` (all rows when ``since`` is None), ordered oldest-first
        so child rows follow parents inside a batch."""

    @abstractmethod
    def scoped_count(self, table: str, user_id: str) -> int:
        """User-scoped row count of ``table``."""


class SqlAlchemySyncRepository(SyncRepository):
    """SQLAlchemy-backed :class:`SyncRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def user_exists(self, user_id: str) -> bool:
        """True when the user row exists."""
        return self._db.get(User, user_id) is not None

    def get_by_pk(self, model: type[Any], pk: str) -> Any | None:
        """Primary-key lookup on ``model``, or ``None`` when absent."""
        return self._db.get(model, pk)

    def add(self, entity: Any) -> None:
        """Stage a new row for insertion (no flush or commit)."""
        self._db.add(entity)

    def flush(self) -> None:
        """Flush pending changes to the DB without committing."""
        self._db.flush()

    def commit(self) -> None:
        """Commit the current transaction."""
        self._db.commit()

    def scoped_rows_since(self, table: str, user_id: str, since: datetime | None) -> list[Any]:
        """Return user-scoped rows of ``table`` newer than ``since``.

        Filters to rows whose timestamp is greater than ``since`` (all
        rows when ``since`` is None) and orders oldest-first so child
        rows follow their parents within a batch.
        """
        spec = TABLES[table]
        query = _scoped_query(self._db, table, user_id)
        ts_col = getattr(spec.model, spec.timestamp_field)
        if since is not None:
            query = query.filter(ts_col > since)
        # Order so child rows always follow parents inside one batch —
        # the client applies in order.
        query = query.order_by(ts_col.asc())
        rows: list[Any] = query.all()
        return rows

    def scoped_count(self, table: str, user_id: str) -> int:
        """Return the user-scoped row count of ``table``."""
        count: int = _scoped_query(self._db, table, user_id).count()
        return count


__all__ = ["SyncRepository", "SqlAlchemySyncRepository"]
