"""Sync push + conflict-resolution.

The write side of the sync surface: apply a client's incoming records for
one table (``push_records``), and apply user-decided conflict resolutions
(``apply_resolutions``). Extracted from ``sync_service`` so that module is
the table registry + serialization + the shared per-user scoping primitive
(``_scoped_query`` / ``row_belongs_to_user``, also consumed by backup).

Runtime dependency is one-way: this module imports the registry +
serialization helpers from ``sync_service``; ``sync_service`` never imports
back.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from app.exceptions import ValidationError

from .sync_service import (
    TABLES,
    _apply_record,
    _from_iso,
    row_belongs_to_user,
    serialize_row,
)

if TYPE_CHECKING:
    from app.repositories.sync_repo import SyncRepository


@dataclass
class ConflictBundle:
    table: str
    record_id: str
    local: dict[str, Any]
    remote: dict[str, Any]


@dataclass
class PushResult:
    accepted: list[str] = field(default_factory=list)
    conflicts: list[ConflictBundle] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def push_records(
    repo: SyncRepository,
    user_id: str,
    table: str,
    records: list[dict[str, Any]],
    since: datetime | None,
) -> PushResult:
    """Apply incoming records for one table.

    For an append-only table: insert if id unknown, skip if
    known. For a mutable table: insert if unknown, update if
    local was untouched since ``since``, raise as a conflict if
    BOTH sides changed.
    """
    if table not in TABLES:
        raise ValidationError(f"Unknown sync table: {table!r}")
    spec = TABLES[table]
    model = spec.model
    result = PushResult()

    for record in records:
        record_id = record.get("id")
        if not isinstance(record_id, str) or not record_id:
            result.skipped.append("<no-id>")
            continue
        existing = repo.get_by_pk(model, record_id)
        if spec.append_only:
            if existing is not None:
                result.skipped.append(record_id)
                continue
            row = _apply_record(table, record, None)
            if not row_belongs_to_user(table, row, user_id):
                # Skip rows that don't scope to this user, defensively.
                result.skipped.append(record_id)
                continue
            repo.add(row)
            result.accepted.append(record_id)
            continue

        # Mutable table.
        remote_ts = _from_iso(record.get(spec.timestamp_field))
        if existing is None:
            row = _apply_record(table, record, None)
            if not row_belongs_to_user(table, row, user_id):
                result.skipped.append(record_id)
                continue
            repo.add(row)
            result.accepted.append(record_id)
            continue
        if not row_belongs_to_user(table, existing, user_id):
            # Same id but wrong user — defensive skip. Should
            # never happen in practice because UUIDs collide
            # at 1 in 2**128.
            result.skipped.append(record_id)
            continue
        local_ts: datetime | None = getattr(existing, spec.timestamp_field, None)
        if local_ts is None:
            local_ts = datetime.min.replace(tzinfo=UTC)
        if local_ts.tzinfo is None:
            local_ts = local_ts.replace(tzinfo=UTC)

        # Local untouched since the client's last sync? Accept remote.
        if since is None or local_ts <= since:
            _apply_record(table, record, existing)
            result.accepted.append(record_id)
            continue

        # Both changed. Conflict.
        if remote_ts is not None and local_ts == remote_ts:
            # Same timestamp — treat as no-op accept (idempotent
            # second send of the same write).
            result.accepted.append(record_id)
            continue
        local_dict = serialize_row(table, existing)
        result.conflicts.append(
            ConflictBundle(
                table=table,
                record_id=record_id,
                local=local_dict,
                remote=record,
            )
        )

    if result.accepted or result.conflicts == [] and result.accepted == []:
        # Always commit even on empty acceptance so subsequent
        # cascading reads see a clean transaction.
        repo.commit()
    else:
        repo.flush()
    return result


@dataclass
class Resolution:
    table: str
    record_id: str
    chosen: str  # "local" | "remote" | "merged"
    merged_data: dict[str, Any] | None = None


def apply_resolutions(
    repo: SyncRepository, user_id: str, resolutions: list[Resolution]
) -> dict[str, list[str]]:
    """Apply user-decided conflict resolutions.

    "local" → keep the row as-is (no-op on the server).
    "remote" → overwrite with the remote payload (client must
       have re-sent the data so we keep the API symmetric).
    "merged" → overwrite with the merged payload.

    The client's choice of ``local`` on a server-side row that
    was already overwritten is a true no-op; we still record it
    in ``applied`` so the client can confirm the decision landed.
    """
    applied: list[str] = []
    skipped: list[str] = []
    for resolution in resolutions:
        spec = TABLES.get(resolution.table)
        if spec is None:
            skipped.append(resolution.record_id)
            continue
        existing = repo.get_by_pk(spec.model, resolution.record_id)
        if resolution.chosen == "local":
            if existing is None:
                skipped.append(resolution.record_id)
                continue
            applied.append(resolution.record_id)
            continue
        payload = resolution.merged_data or {}
        if resolution.chosen in {"remote", "merged"}:
            if not payload:
                skipped.append(resolution.record_id)
                continue
            _apply_record(resolution.table, payload, existing)
            if existing is None and payload.get("id"):
                row = _apply_record(resolution.table, payload, None)
                repo.add(row)
            applied.append(resolution.record_id)
        else:
            skipped.append(resolution.record_id)
    repo.commit()
    return {"applied": applied, "skipped": skipped}
