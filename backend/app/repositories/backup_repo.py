"""Repository for backup export + restore persistence (Phase 16; EXP-024).

Owns ONLY the persistence primitives the backup service needs. Every
decision — which tables, which UNIQUE keys to match on, FK remap,
self-referential ordering, type coercion, identity remap, stats — stays
in ``app.services.backup_service``. This layer runs scoped reads, primary-
key / unique-key lookups, the deferred-FK transaction setup, and the
add/flush/commit/rollback transaction controls.

Scoped reads reuse ``sync_service._scoped_query`` (the single source of
the per-table user-scoping rules) bound to this repository's session, so
backup and sync stay consistent.
"""

from __future__ import annotations

from abc import abstractmethod
from collections.abc import Iterator, Sequence
from contextlib import AbstractContextManager, contextmanager
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import User
from app.repositories.base import Repository
from app.services.sync_service import _scoped_query


class BackupRepository(Repository):
    """Persistence contract for backup export + restore."""

    @abstractmethod
    def user_exists(self, user_id: str) -> bool:
        """True when the user row exists."""

    @abstractmethod
    def scoped_rows(self, table: str, user_id: str) -> list[Any]:
        """All rows of ``table`` scoped to ``user_id`` (ORM rows)."""

    @abstractmethod
    def scoped_count(self, table: str, user_id: str) -> int:
        """Row count of ``table`` scoped to ``user_id``."""

    @abstractmethod
    def get_by_pk(self, model: type[Any], pk: str) -> Any | None:
        """Primary-key lookup, or ``None``."""

    @abstractmethod
    def find_by_column_groups(
        self, model: type[Any], groups: Sequence[Sequence[tuple[str, Any]]]
    ) -> Any | None:
        """Return the first row matching any of the ``(column, value)``
        groups, or ``None``.

        Each group is matched with ``AND`` across its pairs, using
        ``IS NULL`` for a ``None`` value and ``==`` otherwise. The
        service decides which groups to pass (the UNIQUE-key selection
        and single-null skip rule live there); this method only runs
        the queries.
        """

    @abstractmethod
    def add(self, entity: Any) -> None:
        """Stage a new row for insertion."""

    @abstractmethod
    def flush(self) -> None:
        """Flush pending changes (per-table FK-safe insert ordering)."""

    @abstractmethod
    def commit(self) -> None:
        """Commit the restore transaction."""

    @abstractmethod
    def rollback(self) -> None:
        """Roll back the pending changes (per-record defensive recovery)."""

    @abstractmethod
    def begin_deferred_fk(self) -> None:
        """Defer FK enforcement to commit for this transaction
        (``PRAGMA defer_foreign_keys=ON``) so a self-referential or
        within-transaction parent/child order cannot trip mid-restore."""

    @abstractmethod
    def savepoint(self) -> AbstractContextManager[None]:
        """Context manager wrapping a nested transaction (SAVEPOINT).

        Restore flushes one table at a time inside this savepoint so a
        single table's failed flush (e.g. an unexpected constraint
        violation) rolls back ONLY that table's pending rows, leaving the
        already-restored tables intact — the import degrades gracefully
        instead of aborting the whole restore with a 500 (#787)."""


class SqlAlchemyBackupRepository(BackupRepository):
    """SQLAlchemy-backed :class:`BackupRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def user_exists(self, user_id: str) -> bool:
        return self._db.get(User, user_id) is not None

    def scoped_rows(self, table: str, user_id: str) -> list[Any]:
        rows: list[Any] = _scoped_query(self._db, table, user_id).all()
        return rows

    def scoped_count(self, table: str, user_id: str) -> int:
        count: int = _scoped_query(self._db, table, user_id).count()
        return count

    def get_by_pk(self, model: type[Any], pk: str) -> Any | None:
        return self._db.get(model, pk)

    def find_by_column_groups(
        self, model: type[Any], groups: Sequence[Sequence[tuple[str, Any]]]
    ) -> Any | None:
        for group in groups:
            query = self._db.query(model)
            for col, value in group:
                column = getattr(model, col)
                query = query.filter(column.is_(None) if value is None else column == value)
            existing = query.one_or_none()
            if existing is not None:
                return existing
        return None

    def add(self, entity: Any) -> None:
        self._db.add(entity)

    def flush(self) -> None:
        self._db.flush()

    def commit(self) -> None:
        self._db.commit()

    def rollback(self) -> None:
        self._db.rollback()

    def begin_deferred_fk(self) -> None:
        self._db.execute(text("PRAGMA defer_foreign_keys=ON"))

    @contextmanager
    def savepoint(self) -> Iterator[None]:
        # ``begin_nested`` emits SAVEPOINT and, on an exception inside the
        # block, rolls back to it (expunging rows added in the block) and
        # re-raises — the caller decides how to record the skipped table.
        with self._db.begin_nested():
            yield


__all__ = ["BackupRepository", "SqlAlchemyBackupRepository"]
