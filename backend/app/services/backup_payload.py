"""The backup payload as a whole: can this build read it, and whose is it.

Read before any row is written by :mod:`app.services.backup_restore`: the
shape and format-version check, the report on what a newer backup carries
that this build skips (#3827), and the re-homing of a backup made under
another identity (#129).
"""

from __future__ import annotations

import re
from typing import Any

from app.exceptions import ValidationError
from app.services.sync_service import TABLES as SYNC_TABLES

from .backup_export import BACKUP_FORMAT, BACKUP_VERSION, PAYLOAD_SEGMENTS

#: Each part is bounded and the input length is checked first, so a long run
#: of digits from an uploaded file cannot make the match slow (CodeQL
#: py/polynomial-redos on the unbounded pattern).
_VERSION_PATTERN = re.compile(r"(\d{1,9})\.(\d{1,9})\.(\d{1,9})")
_MAX_VERSION_LENGTH = 32


def _parse_version(raw: Any) -> tuple[int, int, int] | None:
    """Parse a format version strictly as ``MAJOR.MINOR.PATCH``, else ``None``."""
    if not isinstance(raw, str) or len(raw) > _MAX_VERSION_LENGTH:
        return None
    match = _VERSION_PATTERN.fullmatch(raw)
    if match is None:
        return None
    major, minor, patch = (int(part) for part in match.groups())
    return major, minor, patch


def _require_version(raw: str) -> tuple[int, int, int]:
    """Parse this build's own format version; a malformed one is a build defect."""
    parsed = _parse_version(raw)
    if parsed is None:
        raise RuntimeError(f"BACKUP_VERSION {raw!r} is not MAJOR.MINOR.PATCH.")
    return parsed


_APP_VERSION = _require_version(BACKUP_VERSION)


def _supported_format() -> str:
    """The formats this build reads, e.g. ``"1.x"``."""
    return f"{BACKUP_VERSION.split('.', 1)[0]}.x"


def _check_version(raw: Any) -> None:
    """Reject a format version this build cannot read (#3827).

    A missing or unreadable version is unknown, not old; a newer major is a
    layout this build does not know. Every 1.x change is additive, so a newer
    minor or patch passes and is read with whatever this build knows.

    Raises:
        ValidationError: for an unknown or a newer-major version.
    """
    version = _parse_version(raw)
    if version is None:
        shown = str(raw)[:_MAX_VERSION_LENGTH]
        raise ValidationError(f"Backup format version {shown!r} cannot be read.")
    if version[0] > _APP_VERSION[0]:
        raise ValidationError(
            f"Backup format {raw} is newer than this app reads ({_supported_format()})."
        )


def _has_data(value: Any) -> bool:
    """Whether a payload segment carries anything to restore."""
    if value is None or value == "":
        return False
    if isinstance(value, (list, dict)):
        return len(value) > 0
    return True


def newer_backup_report(payload: dict[str, Any]) -> dict[str, Any]:
    """Name the segments a newer backup carries that this build skips (#3827).

    A current or older backup reports nothing, so the safe paths stay quiet.

    Returns:
        ``{"newer_version": str | None, "skipped_segments": [sorted names]}``.
    """
    version = _parse_version(payload.get("version"))
    if version is None or version <= _APP_VERSION:
        return {"newer_version": None, "skipped_segments": []}
    data: dict[str, Any] = payload.get("data") or {}
    tables = {t for t, rows in data.items() if t not in SYNC_TABLES and _has_data(rows)}
    blocks = {k for k, v in payload.items() if k not in PAYLOAD_SEGMENTS and _has_data(v)}
    return {"newer_version": payload["version"], "skipped_segments": sorted(tables | blocks)}


def validate_payload(payload: Any) -> dict[str, Any]:
    """Surface-shape check. Defends restore against random JSON."""
    if not isinstance(payload, dict):
        raise ValidationError("Backup payload must be a JSON object.")
    if payload.get("format") != BACKUP_FORMAT:
        raise ValidationError(
            f"Unrecognized backup format: {payload.get('format')!r}. Expected {BACKUP_FORMAT!r}."
        )
    _check_version(payload.get("version"))
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValidationError("Backup payload missing 'data' segment.")
    return payload


def remap_user_identity(
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


__all__ = ["newer_backup_report", "remap_user_identity", "validate_payload"]
