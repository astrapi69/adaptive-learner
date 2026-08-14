"""Repository for the SetRun aggregate (EXP-051 / #2125).

Owns the persistence primitives for Durchgang (run/pass) bookkeeping:
which run of each ``(user, set)`` is active, and the ordered history of
runs. The "start a new run" transition matrix (close the active run,
open the next) lives in :mod:`app.services.set_runs`; this layer only
finds, lists, inserts, and controls the transaction boundary.
"""

from __future__ import annotations

from abc import abstractmethod

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import SetRun, User
from app.repositories.base import Repository


class SetRunsRepository(Repository):
    """Persistence contract for set-run rows."""

    @abstractmethod
    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""

    @abstractmethod
    def get_active(self, user_id: str, set_id: str) -> SetRun | None:
        """Return the open run (``closed_at IS NULL``) for the set, or ``None``."""

    @abstractmethod
    def list_for_set(self, user_id: str, set_id: str) -> list[SetRun]:
        """Return every run of ``(user, set)``, oldest run first."""

    @abstractmethod
    def max_run_id(self, user_id: str, set_id: str) -> int | None:
        """Return the highest ``run_id`` recorded for the set, or ``None``."""

    @abstractmethod
    def add(self, row: SetRun) -> None:
        """Stage a new run row for insertion (no flush/commit)."""

    @abstractmethod
    def flush(self) -> None:
        """Flush pending changes so generated ids/state become visible."""

    @abstractmethod
    def commit(self) -> None:
        """Commit the current transaction."""

    @abstractmethod
    def delete_by_set_ids(self, user_id: str, set_ids: list[str]) -> int:
        """Delete the user's run rows for the given set ids; return the count.

        Orphan cleanup (EXP-051 §Waisen): removing a set sweeps ALL of its
        runs, not just the active one.
        """


class SqlAlchemySetRunsRepository(SetRunsRepository):
    """SQLAlchemy-backed :class:`SetRunsRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_user(self, user_id: str) -> User | None:
        """Return the user row by primary key, or ``None`` if absent."""
        return self._db.get(User, user_id)

    def get_active(self, user_id: str, set_id: str) -> SetRun | None:
        """Return the single open run for the set, or ``None`` when none is open."""
        stmt = select(SetRun).where(
            SetRun.user_id == user_id,
            SetRun.set_id == set_id,
            SetRun.closed_at.is_(None),
        )
        return self._db.execute(stmt).scalars().first()

    def list_for_set(self, user_id: str, set_id: str) -> list[SetRun]:
        """Return every run of the set ordered by ``run_id`` ascending."""
        stmt = (
            select(SetRun)
            .where(SetRun.user_id == user_id, SetRun.set_id == set_id)
            .order_by(SetRun.run_id.asc())
        )
        return list(self._db.execute(stmt).scalars().all())

    def max_run_id(self, user_id: str, set_id: str) -> int | None:
        """Return ``MAX(run_id)`` for the set, or ``None`` when it has no runs."""
        stmt = select(func.max(SetRun.run_id)).where(
            SetRun.user_id == user_id,
            SetRun.set_id == set_id,
        )
        return self._db.execute(stmt).scalar_one_or_none()

    def add(self, row: SetRun) -> None:
        """Stage a new run row for insertion (no flush/commit)."""
        self._db.add(row)

    def flush(self) -> None:
        """Flush pending changes so generated ids/state become visible."""
        self._db.flush()

    def commit(self) -> None:
        """Commit the current transaction."""
        self._db.commit()

    def delete_by_set_ids(self, user_id: str, set_ids: list[str]) -> int:
        """Delete the user's run rows for the given set ids; return the count."""
        if not set_ids:
            return 0
        deleted = (
            self._db.query(SetRun)
            .filter(
                SetRun.user_id == user_id,
                SetRun.set_id.in_(set_ids),
            )
            .delete(synchronize_session=False)
        )
        return int(deleted)


__all__ = ["SetRunsRepository", "SqlAlchemySetRunsRepository"]
