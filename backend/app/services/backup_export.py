"""Backup export: gather a user's rows + content sets into a backup dict.

Extracted from ``backup_service`` (the facade). The restore pipeline lives
in ``backup_restore``; the per-table sync surface + ownership checks live
in ``sync_service``.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from app import __version__
from app.exceptions import NotFoundError
from app.repositories.backup_repo import BackupRepository
from app.services.content_backup import dump_content_sets
from app.services.sync_service import (
    TABLES as SYNC_TABLES,
)
from app.services.sync_service import (
    _to_iso,
    serialize_row,
)

logger = logging.getLogger(__name__)


BACKUP_VERSION = "1.3.0"
BACKUP_FORMAT = "adaptive-learner-backup"

# API keys are sensitive; the backup file is meant to travel
# (cloud, USB, email). Stripped on export, ignored on import.
EXCLUDED_USER_SETTINGS_FIELDS: set[str] = {
    "api_key_anthropic",
    "api_key_openai",
    "api_key_gemini",
}


def _strip_excluded_fields(table: str, record: dict[str, Any]) -> dict[str, Any]:
    """Remove sensitive fields (API keys) from a serialized row."""
    if table != "user_settings":
        return record
    return {k: v for k, v in record.items() if k not in EXCLUDED_USER_SETTINGS_FIELDS}


def _gather_user_rows(repo: BackupRepository, user_id: str) -> dict[str, list[dict[str, Any]]]:
    """Build the ``data`` segment: ALL backup tables, scoped to the user.

    Every one of the 30 tables is ALWAYS present, even with zero rows
    (an empty list). A backup is a COMPLETE snapshot of the user's
    state: an empty table is information ("this table had no rows"),
    and a table that is merely absent is ambiguous — was it empty, or
    did the export forget it? That ambiguity was the exact bug class
    chased across #49/#57/#64/#115/#117. The earlier #117 "skip empty
    tables" optimization is intentionally reverted (#126).
    """
    data: dict[str, list[dict[str, Any]]] = {}
    for table in SYNC_TABLES:
        rows = repo.scoped_rows(table, user_id)
        data[table] = [_strip_excluded_fields(table, serialize_row(table, row)) for row in rows]
    return data


def _build_stats(
    data: dict[str, list[dict[str, Any]]],
    content_sets: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Per-table counts + grand total. Cheap derived field for the UI."""
    tables = {table: len(rows) for table, rows in data.items()}
    return {
        "total_records": sum(tables.values()),
        "tables": tables,
        "content_sets": len(content_sets) if content_sets else 0,
    }


def create_backup(
    repo: BackupRepository, user_id: str, storage_mode: str = "api"
) -> dict[str, Any]:
    """Return the JSON backup payload for ``user_id``.

    Raises :class:`NotFoundError` if the user does not exist; the
    user is the scope key for every table query, so a missing user
    means the request is meaningless.

    ``storage_mode`` is a UI hint that travels with the backup
    (the Settings panel shows "this backup was made in Dexie mode"
    on restore). It does not change the wire format.
    """
    if not repo.user_exists(user_id):
        raise NotFoundError(f"User {user_id!r} not found.")
    data = _gather_user_rows(repo, user_id)
    # Downloaded lesson CONTENT lives outside the 30 sync tables (#130).
    # Include it so a restore is self-contained — and so user-generated
    # sets, which exist ONLY in this cache, are not lost.
    content_sets = dump_content_sets()
    return {
        "format": BACKUP_FORMAT,
        "version": BACKUP_VERSION,
        "app_version": __version__,
        "created_at": _to_iso(datetime.now(UTC)),
        "user_id": user_id,
        "storage_mode": storage_mode,
        "data": data,
        "content_sets": content_sets,
        "stats": _build_stats(data, content_sets),
    }


def get_backup_stats(repo: BackupRepository, user_id: str) -> dict[str, Any]:
    """Per-table row counts for one user. Used by the UI for the
    pre-restore "current vs incoming" diff.
    """
    if not repo.user_exists(user_id):
        raise NotFoundError(f"User {user_id!r} not found.")
    tables: dict[str, int] = {}
    for table in SYNC_TABLES:
        # ALL 30 tables, even at zero rows (#126): the pre-restore
        # "current vs incoming" dialog shows the COMPLETE state so the
        # user sees every table, not just the non-empty ones.
        tables[table] = repo.scoped_count(table, user_id)
    return {
        "user_id": user_id,
        "total_records": sum(tables.values()),
        "tables": tables,
    }
