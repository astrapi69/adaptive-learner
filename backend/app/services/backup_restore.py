"""Backup restore: validate + coerce + FK-order + apply a backup payload.

Extracted from ``backup_service`` (the facade). The export pipeline lives
in ``backup_export``; the per-table sync surface + ownership checks live
in ``sync_service``.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Date, DateTime, String, Text, UniqueConstraint

from app.database import Base
from app.exceptions import ValidationError
from app.repositories.backup_repo import BackupRepository
from app.services import crypto
from app.services.content_backup import restore_content_sets
from app.services.sync_service import (
    TABLES as SYNC_TABLES,
)
from app.services.sync_service import (
    TableSpec,
    _from_iso,
    record_belongs_to_user,
    row_belongs_to_user,
)

from .backup_export import BACKUP_FORMAT, EXCLUDED_USER_SETTINGS_FIELDS

logger = logging.getLogger(__name__)


def _spec(table: str) -> TableSpec:
    return SYNC_TABLES[table]


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


_DATETIME_FIELDS_CACHE: dict[str, frozenset[str]] = {}
_TEXT_FIELDS_CACHE: dict[str, frozenset[str]] = {}


def _datetime_fields(table: str) -> frozenset[str]:
    """Return the datetime/date column names of ``table`` from its model.

    Keying coercion off the column TYPE (not a name heuristic) is what
    makes restore robust: a DateTime column whose name does not end in
    ``_at`` — ``imported_messages.timestamp``,
    ``user_streaks.last_freeze_used_on``, ``user_missions.assigned_date``
    — would otherwise reach the INSERT as a raw ISO string and SQLite
    rejects it (BACKUP-RESTORE-DATETIME-01). Cached; the model schema is
    static.
    """
    cached = _DATETIME_FIELDS_CACHE.get(table)
    if cached is not None:
        return cached
    spec = _spec(table)
    table_columns = spec.model.__table__.columns
    fields = frozenset(
        col
        for col in spec.columns
        if (column := table_columns.get(col)) is not None
        and isinstance(column.type, (DateTime, Date))
    )
    _DATETIME_FIELDS_CACHE[table] = fields
    return fields


def _text_fields(table: str) -> frozenset[str]:
    """Return the String/Text column names of ``table`` from its model.

    JSON-in-text columns (``badges.tier_thresholds``, ``lessons``'
    content, etc.) are declared ``Text`` and store a JSON STRING. A
    backup produced where the value was a parsed object — an older
    export, or a Dexie-origin file — carries it as a dict/list, which
    SQLite cannot bind to a text column ("type 'dict' is not
    supported"). Keying off the column TYPE lets the coercer re-serialize
    those values regardless of the backup's origin. Cached; the schema is
    static.
    """
    cached = _TEXT_FIELDS_CACHE.get(table)
    if cached is not None:
        return cached
    spec = _spec(table)
    table_columns = spec.model.__table__.columns
    fields = frozenset(
        col
        for col in spec.columns
        if (column := table_columns.get(col)) is not None
        and isinstance(column.type, (String, Text))
    )
    _TEXT_FIELDS_CACHE[table] = fields
    return fields


#: Table whose key column differs by storage mode (cleartext ``key`` in a
#: Dexie backup vs Fernet ``encrypted_key`` in the backend).
API_KEY_BACKUP_TABLE = "api_key_backups"


def _normalize_api_key_backups(
    records: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    """Reconcile ``api_key_backups`` rows across storage modes before insert.

    The backend column is ``encrypted_key`` (Fernet ciphertext, NOT NULL).
    A Dexie-mode backup instead carries the key in a cleartext ``key``
    field (browser-local IndexedDB keeps keys in the clear). Restoring such
    a row verbatim leaves ``encrypted_key`` NULL, and the INSERT aborts the
    WHOLE restore with ``NOT NULL constraint failed: api_key_backups.
    encrypted_key`` (#787).

    Per row:
      - a non-empty ``encrypted_key`` (API-origin backup) is kept as-is;
      - else a non-empty cleartext ``key`` is encrypted to THIS install's
        secret and stored as ``encrypted_key`` (the rollback cache is
        re-homed, usable on the importing install);
      - a row with neither — or whose encryption fails — is dropped, so the
        user simply re-enters that key in Settings.

    Returns ``(usable_rows, dropped_count)``. Never raises.
    """
    usable: list[dict[str, Any]] = []
    dropped = 0
    for record in records:
        existing = record.get("encrypted_key")
        if isinstance(existing, str) and existing:
            usable.append(record)
            continue
        cleartext = record.get("key")
        if isinstance(cleartext, str) and cleartext:
            try:
                ciphertext = crypto.encrypt_api_key(cleartext)
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning(
                    "api_key_backups: could not encrypt an imported key, dropping row: %s",
                    exc,
                )
                dropped += 1
                continue
            usable.append({**record, "encrypted_key": ciphertext})
            continue
        dropped += 1
    return usable, dropped


def _coerce_record(table: str, record: dict[str, Any]) -> dict[str, Any]:
    """Per-column type coercion (ISO strings to datetimes; dict/list to
    JSON strings for text columns)."""
    spec = _spec(table)
    datetime_fields = _datetime_fields(table)
    text_fields = _text_fields(table)
    coerced: dict[str, Any] = {}
    for col in spec.columns:
        if col not in record:
            continue
        value = record[col]
        if value is None:
            coerced[col] = None
            continue
        if col in datetime_fields and isinstance(value, str):
            value = _from_iso(value)
        elif col in text_fields and isinstance(value, (dict, list)):
            # A JSON-in-text column (e.g. badges.tier_thresholds) whose
            # backup value is a parsed object — serialize it so SQLite
            # can bind it to the text column.
            logger.debug("Coerced %s.%s: %s -> json string", table, col, type(value).__name__)
            value = json.dumps(value)
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


# Cross-install FK remap (issues #49 + #115). When a parent row is
# matched by a UNIQUE key under a different id than the backup carried,
# child rows that reference it by id must be redirected to the LOCAL id.
# Derived from the real FK graph (``{child_table: {fk_column:
# parent_table}}``) so EVERY parent that gets unique-matched redirects
# its children — not just the one hand-listed ``user_badges -> badges``
# pair the original #49 fix covered. Self-referential FKs are excluded
# (handled by ``PRAGMA defer_foreign_keys``); the parent is always
# restored first (FK-topological _RESTORE_ORDER), so its remap is ready.
def _derive_fk_parents() -> dict[str, dict[str, str]]:
    parents: dict[str, dict[str, str]] = {}
    for table_name, spec in SYNC_TABLES.items():
        columns: dict[str, str] = {}
        for column in spec.model.__table__.columns:
            for foreign_key in column.foreign_keys:
                parent_table = foreign_key.column.table.name
                if parent_table != table_name and parent_table in SYNC_TABLES:
                    columns[column.name] = parent_table
        if columns:
            parents[table_name] = columns
    return parents


_FK_PARENTS: dict[str, dict[str, str]] = _derive_fk_parents()


def _derive_self_ref_columns() -> dict[str, tuple[str, ...]]:
    """``{table: (self_referential_fk_column, ...)}``.

    A self-referential FK (``subjects.parent_id -> subjects``,
    ``learning_topics.parent_id -> learning_topics``) is excluded from
    ``_FK_PARENTS`` (which only maps cross-table parents). But when a row
    is reconciled to a DIFFERENT local id by natural key (#127 subjects),
    its CHILDREN in the same table reference the old backup id and must be
    redirected to the local id too — otherwise the child either inserts a
    dangling FK or fails to match. This map drives that remap; the
    restore additionally orders a self-ref table's rows parent-before-
    child so the parent's id mapping is known by the time the child is
    processed.
    """
    self_refs: dict[str, tuple[str, ...]] = {}
    for table_name, spec in SYNC_TABLES.items():
        cols = tuple(
            column.name
            for column in spec.model.__table__.columns
            for foreign_key in column.foreign_keys
            if foreign_key.column.table.name == table_name
        )
        if cols:
            self_refs[table_name] = cols
    return self_refs


_SELF_REF_COLUMNS: dict[str, tuple[str, ...]] = _derive_self_ref_columns()


def _order_parent_before_child(
    records: list[dict[str, Any]], self_ref_cols: tuple[str, ...]
) -> list[dict[str, Any]]:
    """Sort records of a self-referential table so a row's in-table
    parent always precedes it.

    Rows whose self-ref FK is null, or points outside this batch, are
    roots and come first. A cycle (should never happen in a tree) falls
    back to appending the remainder in input order so no record is lost.
    """
    by_id = {r.get("id"): r for r in records if isinstance(r.get("id"), str)}
    ordered: list[dict[str, Any]] = []
    placed: set[str] = set()

    def parents_in_batch(record: dict[str, Any]) -> list[str]:
        result: list[str] = []
        for col in self_ref_cols:
            parent_id = record.get(col)
            if isinstance(parent_id, str) and parent_id in by_id and parent_id != record.get("id"):
                result.append(parent_id)
        return result

    def place(record: dict[str, Any], guard: set[str]) -> None:
        record_id = record.get("id")
        if not isinstance(record_id, str) or record_id in placed or record_id in guard:
            return
        guard.add(record_id)
        for parent_id in parents_in_batch(record):
            place(by_id[parent_id], guard)
        if record_id not in placed:
            placed.add(record_id)
            ordered.append(record)

    for record in records:
        place(record, set())
    # Append anything without a usable id (handled/skipped downstream).
    for record in records:
        if not isinstance(record.get("id"), str):
            ordered.append(record)
    return ordered


def _unique_match_keys(model: type[Any]) -> list[tuple[str, ...]]:
    """UNIQUE column-groups of ``model`` other than the primary key.

    Covers both column-level ``unique=True`` (e.g. ``badges.key``,
    ``user_settings.user_id``) and table-level composite
    ``UniqueConstraint`` (e.g. ``element_errors``'s six-column key).
    These are the keys a restore must reconcile on when the backup's id
    misses but the row already exists locally under a different id
    (#115).
    """
    table = model.__table__
    pk = {col.name for col in table.primary_key.columns}
    seen: set[tuple[str, ...]] = set()
    keys: list[tuple[str, ...]] = []
    for column in table.columns:
        if column.unique and column.name not in pk:
            key = (column.name,)
            if key not in seen:
                seen.add(key)
                keys.append(key)
    for constraint in table.constraints:
        if isinstance(constraint, UniqueConstraint):
            cols = tuple(col.name for col in constraint.columns)
            if cols and set(cols) != pk and cols not in seen:
                seen.add(cols)
                keys.append(cols)
    return keys


def _find_existing_by_unique(
    repo: BackupRepository, model: type[Any], record: dict[str, Any]
) -> Any | None:
    """Find a local row matching any of ``model``'s UNIQUE keys.

    Returns the first existing row whose unique-key columns all equal the
    record's values, or None. This function owns the BUSINESS rule of
    WHICH key-groups to try; the repository runs the actual queries.

    Null handling differs by key shape:
    - A SINGLE-column key whose value is null is skipped — a NULL never
      participates in a UNIQUE match (a user with no email is matched by
      id only, never by a null email).
    - A COMPOSITE key with a null component is still a precise locator
      (``parent_id IS NULL AND name = 'X'`` identifies exactly one root
      subject), so it matches with ``IS NULL`` on the null part instead
      of being skipped. This is what lets a restore reconcile root-level
      ``subjects`` against the seeded tree (#127). The only composite key
      with a nullable component is ``subjects.(parent_id, name)``.
    """
    groups: list[list[tuple[str, Any]]] = []
    for cols in _unique_match_keys(model):
        values = [record.get(col) for col in cols]
        if len(cols) == 1 and values[0] is None:
            continue
        groups.append(list(zip(cols, values, strict=True)))
    return repo.find_by_column_groups(model, groups)


def _missing_fk_parent(repo: BackupRepository, table: str, record: dict[str, Any]) -> str | None:
    """Return a referenced parent table whose row is absent, else None.

    Restore inserts parents before children (FK-topological
    ``_RESTORE_ORDER``, flushed per table), so by the time a child
    record is processed every legitimate parent already exists. A
    non-null FK that still resolves to no row marks an orphan whose
    insert would abort the WHOLE restore with a deferred FOREIGN KEY
    failure at commit (issue #64 — e.g. an ``imported_messages`` row
    whose ``imported_conversations`` parent is gone). Self-referential
    FKs are skipped; they are handled by ``PRAGMA defer_foreign_keys``.

    Args:
        repo: Backup repository over the active restore session
            (parents already flushed).
        table: The child table being restored.
        record: The backup record about to be inserted.

    Returns:
        The missing parent table name, or None when all parents exist.
    """
    model = _spec(table).model
    for column in model.__table__.columns:
        for foreign_key in column.foreign_keys:
            parent_table: str = foreign_key.column.table.name
            if parent_table == table:
                continue
            fk_value = record.get(column.name)
            if fk_value is None:
                continue
            parent_spec = SYNC_TABLES.get(parent_table)
            if parent_spec is None:
                continue
            if repo.get_by_pk(parent_spec.model, fk_value) is None:
                return parent_table
    return None


def _restore_table(
    repo: BackupRepository,
    table: str,
    records: list[dict[str, Any]],
    user_id: str,
    id_remap: dict[str, dict[str, str]],
) -> dict[str, Any]:
    """Restore one table's worth of records. Returns per-table summary.

    ``id_remap`` accumulates ``{parent_table: {backup_id: local_id}}``
    so a natural-key match on a seeded catalog row (e.g. ``badges``)
    redirects child FKs (e.g. ``user_badges.badge_id``) to the local id.
    """
    spec = _spec(table)
    fk_remap = _FK_PARENTS.get(table, {})
    self_ref_cols = _SELF_REF_COLUMNS.get(table, ())
    api_keys_skipped = 0
    if table == API_KEY_BACKUP_TABLE:
        # Translate cleartext-``key`` rows from a Dexie backup into the
        # backend's Fernet ``encrypted_key`` (or drop them), so the INSERT
        # never hits the NOT NULL constraint (#787).
        records, api_keys_skipped = _normalize_api_key_backups(records)
    # A self-referential table must process parents before children so a
    # parent reconciled to a different local id is already in ``id_remap``
    # when its child is redirected (#127 subjects).
    if self_ref_cols:
        records = _order_parent_before_child(records, self_ref_cols)
    tally: dict[str, Any] = {"inserted": 0, "updated": 0, "skipped": 0, "errors": []}
    if api_keys_skipped:
        tally["api_keys_skipped"] = api_keys_skipped
    for record in records:
        outcome, error = _restore_one_record(
            repo, spec, table, record, user_id, id_remap, fk_remap, self_ref_cols
        )
        tally[outcome] += 1
        if error is not None:
            tally["errors"].append(error)
    return tally


def _restore_one_record(
    repo: BackupRepository,
    spec: TableSpec,
    table: str,
    record: dict[str, Any],
    user_id: str,
    id_remap: dict[str, dict[str, str]],
    fk_remap: dict[str, str],
    self_ref_cols: tuple[str, ...],
) -> tuple[str, str | None]:
    """Restore one record. Returns ``(outcome, error)`` where outcome is one of
    ``"inserted"`` / ``"updated"`` / ``"skipped"`` and error is an optional
    per-record message for the table summary."""
    record_id = record.get("id")
    if not isinstance(record_id, str) or not record_id:
        return "skipped", f"{table}: record missing 'id'"
    record = _redirect_record_fks(record, table, fk_remap, self_ref_cols, id_remap)
    try:
        return _apply_record(repo, spec, table, record, record_id, user_id, id_remap)
    except Exception as exc:  # pragma: no cover — defensive
        repo.rollback()
        logger.error(
            "Failed to restore row in %r (id=%s): %s",
            table,
            record_id,
            exc,
            exc_info=True,
        )
        return "skipped", f"{table}: {record_id}: {exc}"


def _redirect_record_fks(
    record: dict[str, Any],
    table: str,
    fk_remap: dict[str, str],
    self_ref_cols: tuple[str, ...],
    id_remap: dict[str, dict[str, str]],
) -> dict[str, Any]:
    """Redirect cross-table and self-referential FK columns through ``id_remap``.

    A parent matched by natural key under a different local id (issue #49)
    redirects its children's FKs; self-referential columns (e.g.
    ``subjects.parent_id``, #127) redirect through this table's own remap.
    """
    for fk_col, parent_table in fk_remap.items():
        fk_value = record.get(fk_col)
        if not isinstance(fk_value, str):
            continue
        mapped = id_remap.get(parent_table, {}).get(fk_value)
        if mapped is not None and mapped != fk_value:
            record = {**record, fk_col: mapped}
    for self_col in self_ref_cols:
        fk_value = record.get(self_col)
        if not isinstance(fk_value, str):
            continue
        mapped = id_remap.get(table, {}).get(fk_value)
        if mapped is not None and mapped != fk_value:
            record = {**record, self_col: mapped}
    return record


def _apply_record(
    repo: BackupRepository,
    spec: TableSpec,
    table: str,
    record: dict[str, Any],
    record_id: str,
    user_id: str,
    id_remap: dict[str, dict[str, str]],
) -> tuple[str, str | None]:
    """Insert or merge one already-FK-redirected record. Returns ``(outcome, error)``."""
    model = spec.model
    existing = repo.get_by_pk(model, record_id)
    # Unique-key fallback (#115, generalises the #49 badges fix): the backup
    # id missed, but a row with the same UNIQUE key exists locally under a
    # different id — an older backup, a clean install that auto-seeded a
    # user_settings/xp/streak singleton, or a re-seeded catalog. Match it,
    # update in place, and remember the id mapping so child FKs redirect.
    matched_by_unique = False
    if existing is None:
        existing = _find_existing_by_unique(repo, model, record)
        if existing is not None:
            matched_by_unique = True
            if existing.id != record_id:
                id_remap.setdefault(table, {})[record_id] = existing.id
    if existing is None:
        return _insert_new_record(repo, spec, table, record, record_id, user_id)
    # Existing row. Defensive scope check on the row itself.
    if not row_belongs_to_user(table, existing, user_id):
        return "skipped", None
    if spec.append_only:
        # History is immutable; an append-only row already present (by id OR
        # by its unique key) is left untouched.
        return "skipped", None
    if matched_by_unique:
        # The row exists only under a DIFFERENT id — a placeholder the install
        # auto-seeded (e.g. an empty user_settings / user_xp) occupying the
        # unique slot. A restore reclaims it: the backup is the source of
        # truth, so overwrite regardless of timestamp (#115). Without this, a
        # fresh install's newer-but-empty placeholder would beat the backup
        # under merge's newer-wins rule and silently drop the restored data.
        _apply_columns(table, record, existing, allow_pk=False)
        return "updated", None
    remote_ts = _record_timestamp(spec, record)
    local_ts = _row_timestamp(spec, existing)
    if remote_ts is None or local_ts is None or remote_ts > local_ts:
        _apply_columns(table, record, existing, allow_pk=False)
        return "updated", None
    # Same row by id, local is newer (or equal). Merge keeps the newer side.
    return "skipped", None


def _insert_new_record(
    repo: BackupRepository,
    spec: TableSpec,
    table: str,
    record: dict[str, Any],
    record_id: str,
    user_id: str,
) -> tuple[str, str | None]:
    """Insert a record with no existing match. Returns ``(outcome, error)``."""
    # Defensive user-scope check: never insert a row claiming to belong to a
    # different user.
    if not record_belongs_to_user(table, record, user_id):
        return "skipped", None
    missing_parent = _missing_fk_parent(repo, table, record)
    if missing_parent is not None:
        return (
            "skipped",
            f"{table}: {record_id} skipped — references a missing {missing_parent} row",
        )
    fresh = spec.model()
    _apply_columns(table, record, fresh, allow_pk=True)
    repo.add(fresh)
    return "inserted", None


# Restore order: parents before children. Derived from SQLAlchemy's
# metadata, whose ``sorted_tables`` is a TOPOLOGICAL sort over the
# real FK graph (a referenced table always precedes the tables that
# reference it), intersected with the sync surface so the export and
# restore can never drift on the table SET (BACKUP-API-RESTORE-01).
#
# This replaces the previous hand-assigned ``TableSpec.order`` integers,
# which had a silent gap: ``curriculums`` and ``learning_sessions`` both
# carry an ``imported_conversation_id`` FK, but ``imported_conversations``
# was ordered AFTER them — so restoring a curriculum/session that came
# from a chat import violated the FK. Deriving from the FK graph makes
# that class of bug impossible (a new FK is auto-ordered), and the
# comprehensive FK-position pin test guards it.
#
# Intra-table self-referential FKs (``learning_topics.parent_id``,
# ``subjects.parent_id``) cannot be solved by TABLE ordering — a child
# row may precede its parent within the same table's row list — so the
# restore additionally defers FK enforcement to commit (see
# ``restore_backup``: ``PRAGMA defer_foreign_keys=ON``).
_SYNC_TABLE_NAMES: frozenset[str] = frozenset(SYNC_TABLES)
_RESTORE_ORDER: tuple[str, ...] = tuple(
    table.name for table in Base.metadata.sorted_tables if table.name in _SYNC_TABLE_NAMES
)


def _remap_user_identity(
    data: dict[str, Any], source_user_id: str, target_user_id: str
) -> dict[str, list[dict[str, Any]]]:
    """Re-home every backup row from ``source_user_id`` to ``target_user_id``.

    The disaster-recovery case (#129): the backup was made under a prior
    identity (a wiped/re-created install, or a Dexie-origin file), so its
    ``users.id`` and every ``user_id`` column carry the OLD id. The merge
    restore scopes by user, so without re-homing, every user-scoped PARENT
    (conversations, curriculums, projects, sessions) is rejected and all
    their children cascade-fail with "missing parent". Substituting the
    user identity makes the whole backup belong to the importing user, so
    parents insert and children resolve.

    Only the user identity is remapped; all other ids (project, session,
    conversation, ...) keep their backup values and reconcile through the
    existing id/natural-key matching.
    """
    remapped: dict[str, list[dict[str, Any]]] = {}
    for table, records in data.items():
        if not isinstance(records, list):
            remapped[table] = records
            continue
        new_records: list[dict[str, Any]] = []
        for record in records:
            if not isinstance(record, dict):
                new_records.append(record)
                continue
            updated = dict(record)
            if table == "users" and updated.get("id") == source_user_id:
                updated["id"] = target_user_id
            if updated.get("user_id") == source_user_id:
                updated["user_id"] = target_user_id
            new_records.append(updated)
        remapped[table] = new_records
    return remapped


def restore_backup(
    repo: BackupRepository, payload: Any, *, target_user_id: str | None = None
) -> dict[str, Any]:
    """Apply a backup payload to the database. Merge semantics.

    ``target_user_id`` overrides the user_id stored in the backup file.
    Default behaviour uses the backup's own ``user_id`` so a user can
    restore on the same install they exported from. When the override
    differs from the backup's own ``user_id`` (disaster recovery onto a
    fresh/re-created install, or a Dexie-origin backup), the entire backup
    is re-homed to the importing user via :func:`_remap_user_identity`
    (#129).
    """
    payload = _validate_payload(payload)
    source_user_id = payload.get("user_id")
    user_id = target_user_id or source_user_id
    if not isinstance(user_id, str) or not user_id:
        raise ValidationError("Backup payload missing 'user_id'.")

    data: dict[str, list[dict[str, Any]]] = payload["data"]

    # Re-home a cross-identity backup to the importing user (#129).
    if isinstance(source_user_id, str) and source_user_id and source_user_id != user_id:
        logger.info("Backup restore re-homing identity %s -> %s", source_user_id, user_id)
        data = _remap_user_identity(data, source_user_id, user_id)

    # Defer FK enforcement to the final commit for THIS transaction.
    # _RESTORE_ORDER already inserts parent TABLES before child tables,
    # but self-referential FKs (learning_topics.parent_id,
    # subjects.parent_id) can still see a child row inserted before its
    # parent row within the same table — table ordering can't fix that.
    # Deferring checks until commit lets the rows land in any order as
    # long as the final, fully-restored state is FK-consistent. SQLite
    # resets this pragma at the end of the transaction automatically.
    repo.begin_deferred_fk()

    per_table: dict[str, Any] = {}
    total_inserted = 0
    total_updated = 0
    total_skipped = 0
    total_api_keys_skipped = 0
    all_errors: list[str] = []
    # Accumulates {parent_table: {backup_id: local_id}} for natural-key
    # matches so child FKs are redirected to the local id (issue #49).
    id_remap: dict[str, dict[str, str]] = {}

    incoming = sum(len(v) for v in data.values() if isinstance(v, list))
    logger.info(
        "Backup restore starting for user %s: %d records across %d tables in payload",
        user_id,
        incoming,
        len(data),
    )

    for table in _RESTORE_ORDER:
        records = data.get(table, [])
        if not isinstance(records, list):
            all_errors.append(f"{table}: expected list, got {type(records).__name__}")
            logger.error(
                "Restoring table %r skipped: expected list, got %s", table, type(records).__name__
            )
            continue
        summary: dict[str, Any]
        if records:
            # Restore + flush each table inside its own SAVEPOINT so a
            # single table's unexpected flush failure (a constraint we did
            # not anticipate from a foreign / cross-mode backup) rolls back
            # ONLY that table and the rest of the import still completes —
            # a partial restore beats a 500 that loses everything (#787).
            # Flush after each table so the explicit FK-safe _RESTORE_ORDER
            # (parents first) is what actually drives insert order. The
            # session runs with autoflush=False and a single commit would
            # otherwise reorder inserts by ORM relationship() topology — and
            # the gamification / SRS / content tables are deliberately
            # decoupled (FK columns, no relationships), so the unit-of-work
            # has no way to know a child must follow its parent. Flushing
            # per table in our own order sidesteps that entirely.
            try:
                with repo.savepoint():
                    summary = _restore_table(repo, table, records, user_id, id_remap)
                    repo.flush()
            except Exception as exc:
                logger.error(
                    "Restoring table %r failed at flush; table skipped, import continues: %s",
                    table,
                    exc,
                    exc_info=True,
                )
                summary = {
                    "inserted": 0,
                    "updated": 0,
                    "skipped": len(records),
                    "errors": [f"{table}: skipped (flush failed): {exc}"],
                }
        else:
            # An empty table is still recorded (#126) so the per-table
            # summary covers all 30 tables, not just the non-empty ones.
            summary = {"inserted": 0, "updated": 0, "skipped": 0, "errors": []}
        logger.info(
            "Restoring table %r: %d rows (insert: %d, update: %d, skip: %d, errors: %d)",
            table,
            len(records),
            summary["inserted"],
            summary["updated"],
            summary["skipped"],
            len(summary["errors"]),
        )
        per_table[table] = summary
        total_inserted += summary["inserted"]
        total_updated += summary["updated"]
        total_skipped += summary["skipped"]
        total_api_keys_skipped += summary.get("api_keys_skipped", 0)
        all_errors.extend(summary["errors"])

    repo.commit()
    logger.info(
        "Restore complete: %d total, %d inserted, %d updated, %d skipped, %d errors",
        total_inserted + total_updated + total_skipped,
        total_inserted,
        total_updated,
        total_skipped,
        len(all_errors),
    )
    if all_errors:
        for err in all_errors:
            logger.error("Restore error: %s", err)

    # Restore downloaded content sets into the cache (#130). Done AFTER the
    # DB commit so a content-write failure can never roll back user data;
    # the content cache is a filesystem store, independent of the DB
    # transaction. Absent in pre-1.3.0 backups -> a no-op.
    content_summary = restore_content_sets(payload.get("content_sets"))
    all_errors.extend(content_summary["errors"])

    return {
        "user_id": user_id,
        "inserted": total_inserted,
        "updated": total_updated,
        "skipped": total_skipped,
        # Count of API-key rollback-cache rows that could not be imported
        # (no usable key in the backup). Non-zero -> the UI tells the user
        # to re-enter their API keys in Settings (#787).
        "api_keys_skipped": total_api_keys_skipped,
        "errors": all_errors,
        "tables": per_table,
        "content_sets": content_summary,
    }
