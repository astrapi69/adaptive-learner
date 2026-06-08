"""Repository for the Danger-Zone reset (Phase 41F; EXP-024 Phase 1).

Owns the one destructive persistence primitive: truncating every table
in reverse-FK order. The filesystem scrubs (identity.yaml, the
secrets.yaml ``ai`` block) and the confirmation-token policy stay in
``app.services.reset_service``.
"""

from __future__ import annotations

from abc import abstractmethod

from sqlalchemy.orm import Session

from app.database import Base
from app.repositories.base import Repository


class ResetRepository(Repository):
    """Persistence contract for the full-database reset."""

    @abstractmethod
    def truncate_all_tables(self) -> int:
        """Delete every row in every table (reverse-FK order), commit,
        and return the number of tables touched."""


class SqlAlchemyResetRepository(ResetRepository):
    """SQLAlchemy-backed :class:`ResetRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def truncate_all_tables(self) -> int:
        tables = list(reversed(Base.metadata.sorted_tables))
        for table in tables:
            self._db.execute(table.delete())
        self._db.commit()
        return len(tables)


__all__ = ["ResetRepository", "SqlAlchemyResetRepository"]
