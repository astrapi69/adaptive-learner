"""Cross-device sync service (Phase 13A).

Implements the protocol the ``routers/sync.py`` endpoints expose.
Two record classes:

- **Append-only** (LearningSession, SessionMessage, SessionRating,
  ProgressCommit, MethodSwitch, StepEvaluation, SessionNote):
  history rows that, once written, never change. Sync is
  idempotent — insert if the UUID is unknown, skip otherwise. No
  conflicts possible.

- **Mutable** (User, UserSettings, LearningProject, LearningProfile,
  Curriculum, LearningTopic, Lesson): rows the user edits over
  time. Sync compares ``updated_at`` vs the client's
  ``since`` timestamp:
    * Local untouched since ``since`` → accept remote.
    * Local updated since ``since`` AND remote also updated → CONFLICT.
      The conflict bundle goes back to the client for resolution.

v1.8.0 / Phase 21D — ImportedConversation + ImportedMessage are
now in the sync surface. Both are classified APPEND-ONLY (the
``analysis_result`` blob and ``analyzed`` flag are NOT updated
post-sync; each device runs its own analysis). The Pydantic
schema serialises ``analysis_result`` to/from JSON text at the
storage boundary; the wire shape stays a dict.

Identity model: the pairing flow has already aligned the
``user_id`` on both devices. Every sync call carries the same
``user_id`` and we scope every query to it so a multi-tenant
backend (future) doesn't leak rows.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models import (
    Curriculum,
    ImportedConversation,
    LearningProject,
    LearningSession,
)

# TABLES + TableSpec live in sync_tables.py (extracted, #1795-style: this
# file had grown past the file-size gate's 950-line error threshold).
# Imported (not just referenced) here so every existing
# ``from app.services.sync_service import TABLES`` / ``sync_service.TABLES``
# keeps working unchanged - this module is the historical import path,
# sync_tables.py is now the source of truth.
from app.services.sync_tables import (  # noqa: F401
    ALL_SYNC_TABLES,
    APPEND_ONLY_TABLES,
    MUTABLE_TABLES,
    TABLES,
    TableSpec,
)

if TYPE_CHECKING:
    # Type-only import: the orchestration functions take a SyncRepository,
    # but sync_repo imports _scoped_query / TABLES from THIS module at
    # runtime (EXP-024 Option A). PEP 563 string annotations + this guard
    # keep that a one-way runtime dependency (sync_repo -> sync_service).
    from app.repositories.sync_repo import SyncRepository

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Serialisation
# ---------------------------------------------------------------------------


def _to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat()


def _from_iso(value: str | None) -> datetime | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt


def serialize_row(table: str, row: Any) -> dict[str, Any]:
    """Project an ORM row to a plain JSON dict.

    Datetime fields land as ISO 8601 strings. Booleans / strings /
    numbers pass through. We never include columns outside the
    table's declared ``columns`` tuple — that keeps any future
    sensitive column (e.g. an encrypted blob) from accidentally
    flowing across the sync wire.
    """
    spec = TABLES[table]
    out: dict[str, Any] = {}
    for col in spec.columns:
        value = getattr(row, col, None)
        if isinstance(value, datetime):
            value = _to_iso(value)
        out[col] = value
    return out


def _coerce_field(table: str, col: str, value: Any) -> Any:
    if col.endswith("_at") or col == "assessed_at":
        if isinstance(value, str):
            return _from_iso(value)
    return value


def _apply_record(table: str, record: dict[str, Any], existing: Any | None) -> Any:
    spec = TABLES[table]
    target = existing if existing is not None else spec.model()
    for col in spec.columns:
        if col == "id" and existing is not None:
            continue  # never overwrite PK
        if col in record:
            setattr(target, col, _coerce_field(table, col, record[col]))
    return target


# ---------------------------------------------------------------------------
# Push / pull
# ---------------------------------------------------------------------------


def row_belongs_to_user(table: str, row: Any, user_id: str) -> bool:
    """Canonical defensive check: does ORM ``row`` belong to ``user_id``?

    This is the single source of truth for per-user ownership, shared by
    sync (push acceptance) and backup (restore). Both surfaces MUST agree,
    because a drift can leak a row across users (wrong ``True``) or drop a
    legitimately-owned row (wrong ``False``); issue #329 consolidated two
    copies that had diverged.

    Resolution per ``TableSpec.scope``:

    - ``self``: the row IS the user (``users`` table) -> ``row.id == user_id``.
    - ``global``: shared, not user-tied (Subjects taxonomy, Badge catalog)
      -> every device/user owns every row.
    - everything else (``direct`` + ``via_*``): trust the ``user_id`` column
      when present and set; otherwise trust the parent FK. The per-table
      pull/push/export query already JOINed through to the right user, so an
      absent or NULL direct column means "ownership is via the parent", not
      "foreign". UUID ids make cross-user collision a 1-in-2**128 event.

    The NULL-``user_id`` case is latent today: every model that maps a
    ``user_id`` column types it non-nullable (``Mapped[str]``), and the two
    ``global`` models map none at all, so ``getattr(row, "user_id", None)``
    only yields ``None`` for ``via_*`` rows that carry no such column. The
    explicit ``None -> True`` branch resolves the prior divergence toward
    "trust the parent FK" (the safe direction for restore: no silent data
    loss) and documents the intended behaviour should a nullable ``user_id``
    column ever be added.
    """
    spec = TABLES[table]
    if spec.scope == "self":
        return bool(row.id == user_id)
    if spec.scope == "global":
        return True
    owner = getattr(row, "user_id", None)
    if owner is None:
        return True
    return bool(owner == user_id)


def record_belongs_to_user(table: str, record: dict[str, Any], user_id: str) -> bool:
    """Canonical ownership check on a raw record dict (pre-insert).

    Dict-shaped mirror of :func:`row_belongs_to_user`, used by the backup
    restore before the ORM object exists. A missing ``user_id`` key and an
    explicit ``None`` value are treated identically (both -> trust the parent
    FK), exactly as ``getattr(row, "user_id", None)`` collapses them on the
    ORM side, so the two checks cannot disagree on the same logical row.
    """
    spec = TABLES[table]
    if spec.scope == "self":
        return record.get("id") == user_id
    if spec.scope == "global":
        return True
    owner = record.get("user_id")
    if owner is None:
        return True
    return bool(owner == user_id)


def _scoped_query(db: Session, table: str, user_id: str):
    """Build a per-user-scoped query for one table.

    Handles the nesting paths:
      - ``"self"``  →  WHERE users.id = :user_id
      - ``"direct"`` →  WHERE table.user_id = :user_id
      - ``"via_curriculum"`` →  JOIN curriculums ON ...
      - ``"via_project"`` →  JOIN learning_projects ON ...
      - ``"via_session"`` →  JOIN learning_sessions ON learning_projects ON ...
      - ``"via_imported_conversation"`` →  JOIN imported_conversations
        ON ... (v1.8.0 / Phase 21D, for ``imported_messages``)
    """
    spec = TABLES[table]
    model = spec.model
    query = db.query(model)
    if spec.scope == "self":
        query = query.filter(model.id == user_id)
    elif spec.scope == "global":
        # No user scope — every row is shared across users.
        pass
    elif spec.scope == "direct":
        query = query.filter(model.user_id == user_id)
    elif spec.scope == "via_curriculum":
        query = query.join(Curriculum, Curriculum.id == model.curriculum_id).filter(
            Curriculum.user_id == user_id
        )
    elif spec.scope == "via_project":
        query = query.join(LearningProject, LearningProject.id == model.project_id).filter(
            LearningProject.user_id == user_id
        )
    elif spec.scope == "via_session":
        query = (
            query.join(LearningSession, LearningSession.id == model.session_id)
            .join(LearningProject, LearningProject.id == LearningSession.project_id)
            .filter(LearningProject.user_id == user_id)
        )
    elif spec.scope == "via_imported_conversation":
        query = query.join(
            ImportedConversation,
            ImportedConversation.id == model.conversation_id,
        ).filter(ImportedConversation.user_id == user_id)
    return query


def pull_records(
    repo: SyncRepository,
    user_id: str,
    tables: Iterable[str],
    since: datetime | None,
) -> dict[str, list[dict[str, Any]]]:
    """Return every row in ``tables`` whose timestamp is greater
    than ``since`` (or all rows when ``since`` is None — first
    sync)."""
    out: dict[str, list[dict[str, Any]]] = {}
    for table in tables:
        if table not in TABLES:
            continue
        rows = repo.scoped_rows_since(table, user_id, since)
        out[table] = [serialize_row(table, row) for row in rows]
    return out


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------


def compute_status(repo: SyncRepository, user_id: str) -> dict[str, Any]:
    """Per-table row counts, scoped to the user.

    Used by the Settings sync panel + the periodic
    "is there anything to sync" check. Cheap — single COUNT(*)
    per table.
    """
    if not repo.user_exists(user_id):
        raise NotFoundError(f"User {user_id!r} not found.")
    counts: dict[str, int] = {}
    for table in TABLES:
        counts[table] = repo.scoped_count(table, user_id)
    return {
        "user_id": user_id,
        "counts": counts,
        "server_time": _to_iso(datetime.now(UTC)),
    }


__all__ = [
    "ALL_SYNC_TABLES",
    "APPEND_ONLY_TABLES",
    "MUTABLE_TABLES",
    "TABLES",
    "TableSpec",
    "compute_status",
    "pull_records",
    "record_belongs_to_user",
    "row_belongs_to_user",
    "serialize_row",
]
