"""Backup + restore service (Phase 15A).

Exports a user's full data set as a single JSON document, restores
the same shape back. Designed for two failure modes:

- API/SQLite mode: the user wants a portable copy outside their data
  directory (cloud, USB, off-box) in case the SQLite file dies.
- Dexie mode: the user's IndexedDB is fragile (cache clear, browser
  update, storage eviction). The same JSON shape can be produced
  and consumed browser-side.

Both sides agree on the wire format declared in ``BACKUP_VERSION``.
The backend produces the canonical layout; ``frontend/src/storage/
backup.ts`` mirrors it for Dexie.

Security: API keys are NEVER included in the backup. After a
restore the user must re-enter every provider key. The keys live
in ``UserSettings.api_key_*`` columns; ``EXCLUDED_USER_SETTINGS_FIELDS``
strips them on export and ignores them on import.

Restore semantics are MERGE, not overwrite:

- ID unknown locally → insert from backup.
- ID known locally, append-only row → skip (history is immutable).
- ID known locally, mutable row → keep the newer side
  (compare ``updated_at`` / ``assessed_at``). Equal timestamps are
  treated as idempotent no-ops, not conflicts.

The backup surface is exactly ``sync_service.TABLES`` (every
table the sync layer knows). Both the export and the restore
derive their table set from that single source, so the two
sides can never drift again (BACKUP-API-RESTORE-01: the restore
order had been hand-maintained and silently fell 14 tables
behind the export, dropping gamification / lesson-progress /
SRS-error / missions / anki / study-question / api-key-backup
rows on every API-mode restore).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app import __version__
from app.exceptions import NotFoundError, ValidationError
from app.models import User
from app.services.sync_service import (
    TABLES as SYNC_TABLES,
)
from app.services.sync_service import (
    TableSpec,
    _from_iso,
    _scoped_query,
    _to_iso,
    serialize_row,
)

logger = logging.getLogger(__name__)

BACKUP_VERSION = "1.2.0"
BACKUP_FORMAT = "adaptive-learner-backup"

# API keys are sensitive; the backup file is meant to travel
# (cloud, USB, email). Stripped on export, ignored on import.
EXCLUDED_USER_SETTINGS_FIELDS: set[str] = {
    "api_key_anthropic",
    "api_key_openai",
    "api_key_gemini",
}


# The backup surface IS the sync surface. Deriving from one source
# is what keeps export and restore from drifting (the original
# BACKUP-API-RESTORE-01 bug).
ALL_BACKUP_TABLES: tuple[str, ...] = tuple(SYNC_TABLES.keys())


def _spec(table: str) -> TableSpec:
    return SYNC_TABLES[table]


def _strip_excluded_fields(table: str, record: dict[str, Any]) -> dict[str, Any]:
    """Remove sensitive fields (API keys) from a serialized row."""
    if table != "user_settings":
        return record
    return {k: v for k, v in record.items() if k not in EXCLUDED_USER_SETTINGS_FIELDS}


def _gather_user_rows(db: Session, user_id: str) -> dict[str, list[dict[str, Any]]]:
    """Build the ``data`` segment: every backup table, scoped to the user."""
    data: dict[str, list[dict[str, Any]]] = {}
    for table in SYNC_TABLES:
        rows = _scoped_query(db, table, user_id).all()
        data[table] = [_strip_excluded_fields(table, serialize_row(table, row)) for row in rows]
    return data


def _build_stats(data: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    """Per-table counts + grand total. Cheap derived field for the UI."""
    tables = {table: len(rows) for table, rows in data.items()}
    return {
        "total_records": sum(tables.values()),
        "tables": tables,
    }


def create_backup(db: Session, user_id: str, storage_mode: str = "api") -> dict[str, Any]:
    """Return the JSON backup payload for ``user_id``.

    Raises :class:`NotFoundError` if the user does not exist; the
    user is the scope key for every table query, so a missing user
    means the request is meaningless.

    ``storage_mode`` is a UI hint that travels with the backup
    (the Settings panel shows "this backup was made in Dexie mode"
    on restore). It does not change the wire format.
    """
    if db.get(User, user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    data = _gather_user_rows(db, user_id)
    return {
        "format": BACKUP_FORMAT,
        "version": BACKUP_VERSION,
        "app_version": __version__,
        "created_at": _to_iso(datetime.now(UTC)),
        "user_id": user_id,
        "storage_mode": storage_mode,
        "data": data,
        "stats": _build_stats(data),
    }


def get_backup_stats(db: Session, user_id: str) -> dict[str, Any]:
    """Per-table row counts for one user. Used by the UI for the
    pre-restore "current vs incoming" diff.
    """
    if db.get(User, user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    tables: dict[str, int] = {}
    for table in SYNC_TABLES:
        tables[table] = _scoped_query(db, table, user_id).count()
    return {
        "user_id": user_id,
        "total_records": sum(tables.values()),
        "tables": tables,
    }


# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------


def _validate_payload(payload: Any) -> dict[str, Any]:
    """Surface-shape check. Defends restore against random JSON."""
    if not isinstance(payload, dict):
        raise ValidationError("Backup payload must be a JSON object.")
    if payload.get("format") != BACKUP_FORMAT:
        raise ValidationError(
            f"Unrecognized backup format: {payload.get('format')!r}. Expected {BACKUP_FORMAT!r}."
        )
    version = str(payload.get("version", ""))
    if not version:
        raise ValidationError("Backup payload missing 'version'.")
    # Forward-compat: a future 1.x backup is read with whatever
    # tables this build knows. Unknown segments are skipped.
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValidationError("Backup payload missing 'data' segment.")
    return payload


def _coerce_record(table: str, record: dict[str, Any]) -> dict[str, Any]:
    """Per-column type coercion (ISO strings to datetimes)."""
    spec = _spec(table)
    coerced: dict[str, Any] = {}
    for col in spec.columns:
        if col not in record:
            continue
        value = record[col]
        if value is None:
            coerced[col] = None
            continue
        if col.endswith("_at") or col == "assessed_at":
            if isinstance(value, str):
                value = _from_iso(value)
        coerced[col] = value
    return coerced


def _row_timestamp(spec: TableSpec, row: Any) -> datetime | None:
    value: datetime | None = getattr(row, spec.timestamp_field, None)
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value


def _record_timestamp(spec: TableSpec, record: dict[str, Any]) -> datetime | None:
    raw = record.get(spec.timestamp_field)
    if isinstance(raw, datetime):
        return raw if raw.tzinfo is not None else raw.replace(tzinfo=UTC)
    if isinstance(raw, str):
        return _from_iso(raw)
    return None


def _apply_columns(table: str, record: dict[str, Any], target: Any, *, allow_pk: bool) -> None:
    """Copy fields from a record onto an ORM instance. ``allow_pk``
    flips on for inserts (so the UUID survives) and off for updates.
    """
    spec = _spec(table)
    coerced = _coerce_record(table, record)
    for col in spec.columns:
        if col == "id" and not allow_pk:
            continue
        if col not in record:
            continue
        if table == "user_settings" and col in EXCLUDED_USER_SETTINGS_FIELDS:
            # Never let a backup overwrite a live API key, even
            # if the user hand-edited the JSON.
            continue
        setattr(target, col, coerced.get(col, record[col]))


def _restore_table(
    db: Session,
    table: str,
    records: list[dict[str, Any]],
    user_id: str,
) -> dict[str, Any]:
    """Restore one table's worth of records. Returns per-table summary."""
    spec = _spec(table)
    model = spec.model
    inserted = 0
    updated = 0
    skipped = 0
    errors: list[str] = []
    for record in records:
        record_id = record.get("id")
        if not isinstance(record_id, str) or not record_id:
            skipped += 1
            errors.append(f"{table}: record missing 'id'")
            continue
        try:
            existing = db.get(model, record_id)
            if existing is None:
                # Defensive user-scope check: never insert a row
                # claiming to belong to a different user.
                if not _record_belongs_to_user(table, record, user_id):
                    skipped += 1
                    continue
                fresh = model()
                _apply_columns(table, record, fresh, allow_pk=True)
                db.add(fresh)
                inserted += 1
                continue
            # Existing row. Defensive scope check on the row itself.
            if not _row_belongs_to_user(table, existing, user_id):
                skipped += 1
                continue
            if spec.append_only:
                # History is immutable; do not touch.
                skipped += 1
                continue
            remote_ts = _record_timestamp(spec, record)
            local_ts = _row_timestamp(spec, existing)
            if remote_ts is None or local_ts is None or remote_ts > local_ts:
                _apply_columns(table, record, existing, allow_pk=False)
                updated += 1
            else:
                # Local is newer (or equal). Merge keeps the newer side.
                skipped += 1
        except Exception as exc:  # pragma: no cover — defensive
            db.rollback()
            errors.append(f"{table}: {exc}")
            logger.exception("Backup restore failed for %s/%s", table, record_id)
            skipped += 1
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
    }


def _row_belongs_to_user(table: str, row: Any, user_id: str) -> bool:
    """Defensive user-scoping check used during restore."""
    spec = _spec(table)
    if spec.scope == "self":
        return bool(row.id == user_id)
    if hasattr(row, "user_id") and row.user_id is not None:
        return bool(row.user_id == user_id)
    # via_curriculum / via_project / via_session / via_conversation:
    # the parent FK already pins the user. Trust it.
    return True


def _record_belongs_to_user(table: str, record: dict[str, Any], user_id: str) -> bool:
    """Defensive user-scoping check on raw backup payload before insert."""
    spec = _spec(table)
    if spec.scope == "self":
        return record.get("id") == user_id
    if "user_id" in record and record["user_id"] is not None:
        return bool(record["user_id"] == user_id)
    return True


# Restore order: parents before children. Derived from the SAME
# source as the export (``sync_service.TABLES``) so the two sides
# can never drift again (BACKUP-API-RESTORE-01). ``TableSpec.order``
# already encodes FK dependency — lower numbers (parents) go first —
# which is exactly the order a restore must apply rows in.
_RESTORE_ORDER: tuple[str, ...] = tuple(
    name for name, _spec_ in sorted(SYNC_TABLES.items(), key=lambda kv: kv[1].order)
)


def restore_backup(
    db: Session, payload: Any, *, target_user_id: str | None = None
) -> dict[str, Any]:
    """Apply a backup payload to the database. Merge semantics.

    ``target_user_id`` overrides the user_id stored in the backup
    file. Default behaviour uses the backup's own ``user_id`` so a
    user can restore on the same install they exported from. The
    override path exists for cross-install transfers (a future
    feature; currently unexercised but the parameter is wired so
    the router can pass it explicitly).
    """
    payload = _validate_payload(payload)
    user_id = target_user_id or payload.get("user_id")
    if not isinstance(user_id, str) or not user_id:
        raise ValidationError("Backup payload missing 'user_id'.")

    data: dict[str, list[dict[str, Any]]] = payload["data"]
    per_table: dict[str, Any] = {}
    total_inserted = 0
    total_updated = 0
    total_skipped = 0
    all_errors: list[str] = []

    for table in _RESTORE_ORDER:
        records = data.get(table, [])
        if not isinstance(records, list):
            all_errors.append(f"{table}: expected list, got {type(records).__name__}")
            continue
        summary = _restore_table(db, table, records, user_id)
        per_table[table] = summary
        total_inserted += summary["inserted"]
        total_updated += summary["updated"]
        total_skipped += summary["skipped"]
        all_errors.extend(summary["errors"])

    db.commit()
    return {
        "user_id": user_id,
        "inserted": total_inserted,
        "updated": total_updated,
        "skipped": total_skipped,
        "errors": all_errors,
        "tables": per_table,
    }


__all__ = [
    "ALL_BACKUP_TABLES",
    "BACKUP_FORMAT",
    "BACKUP_VERSION",
    "EXCLUDED_USER_SETTINGS_FIELDS",
    "create_backup",
    "get_backup_stats",
    "restore_backup",
]
