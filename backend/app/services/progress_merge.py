"""Merge two ``lesson_progress`` rows on restore (#3787).

A restore used to replace a whole row whenever the backup's ``updated_at``
was newer, so a lesson completed on one device and later only opened on
another fell back to "in progress". The rule here keeps the learner's
balance and respects a deliberate restart:

- The balance never shrinks: the most ``attempts`` (each one a completion,
  #983), the better best score by percentage (a tie keeps the local pair),
  the joined ``attempt_history`` (newest :data:`ATTEMPT_HISTORY_CAP`), the
  latest ``completed_at``, the earliest ``started_at``, the most
  ``time_spent_seconds``.
- The run state (:data:`LIFECYCLE_FIELDS`) comes whole from one side: a
  completed side wins over a side that has seen fewer completions, two runs
  keep the furthest step, and otherwise the newer side wins as before.
  A side that already holds a completion and restarted afterwards therefore
  keeps its restart. A completed row without ``attempts`` (a 1.2.0 backup)
  counts as one completion.

The browser restore applies the same rule (``storage/lessons/progress-merge.ts``);
both run the cases in ``tests/fixtures/progress-merge-parity/cases.json``.

Example::

    merged, changed = merge_lesson_progress(local_row, backup_record)
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

from app.services.lesson_progress import ATTEMPT_HISTORY_CAP

#: The table this merge applies to.
PROGRESS_TABLE = "lesson_progress"

#: The run state, taken together from one side so it stays consistent.
LIFECYCLE_FIELDS: tuple[str, ...] = (
    "status",
    "lesson_mode",
    "step_results",
    "score_correct",
    "score_total",
    "current_step",
    "run_time_seconds",
    "paused_at",
    "abandoned_at",
    "recent_steps",
    "updated_at",
)

_ACTIVE = frozenset({"in_progress", "paused"})
_JSON_FIELDS = frozenset({"attempt_history", "step_results", "recent_steps"})
_TIME_FIELDS = frozenset({"started_at", "updated_at", "completed_at", "paused_at", "abandoned_at"})


def merge_lesson_progress(
    local: Mapping[str, Any], backup: Mapping[str, Any]
) -> tuple[dict[str, Any], bool]:
    """Merge a backup's ``lesson_progress`` row into the local one.

    Args:
        local: The local row as column values (an ORM row's columns or a dict).
        backup: The backup's record; JSON columns may be strings or parsed.

    Returns:
        The merged row (local identity and local-only fields kept; a field the
        winning side lacks keeps its local value) and whether it differs from
        ``local``.
    """
    source = backup if _run_state_from_backup(local, backup) else local
    merged: dict[str, Any] = dict(local)
    for field in LIFECYCLE_FIELDS:
        if field in source:
            merged[field] = source[field]
    merged.update(_balance(local, backup))
    changed = any(_norm(key, merged[key]) != _norm(key, local.get(key)) for key in merged)
    return merged, changed


def _run_state_from_backup(local: Mapping[str, Any], backup: Mapping[str, Any]) -> bool:
    """Whether the backup's run state wins (see the module rule)."""
    local_done = local.get("status") == "completed"
    backup_done = backup.get("status") == "completed"
    if backup_done and not local_done and _completions(local) < _completions(backup):
        return True
    if local_done and not backup_done and _completions(backup) < _completions(local):
        return False
    if local.get("status") in _ACTIVE and backup.get("status") in _ACTIVE:
        local_step, backup_step = _int(local, "current_step"), _int(backup, "current_step")
        if local_step != backup_step:
            return backup_step > local_step
    remote_ts, local_ts = _ts(backup.get("updated_at")), _ts(local.get("updated_at"))
    return remote_ts is None or local_ts is None or remote_ts > local_ts


def _balance(local: Mapping[str, Any], backup: Mapping[str, Any]) -> dict[str, Any]:
    """The fields that only ever grow: attempts, history, best, times."""
    out: dict[str, Any] = {}
    if "attempts" in local or "attempts" in backup:
        out["attempts"] = max(_int(local, "attempts"), _int(backup, "attempts"))
    if "attempt_history" in local or "attempt_history" in backup:
        out["attempt_history"] = _joined_history(local, backup)
    if any(
        f in side for side in (local, backup) for f in ("best_score_correct", "best_score_total")
    ):
        best = backup if _pct(backup) > _pct(local) else local
        out["best_score_correct"] = _int(best, "best_score_correct")
        out["best_score_total"] = _int(best, "best_score_total")
    for field, pick_latest in (("completed_at", True), ("started_at", False)):
        if field in local or field in backup:
            out[field] = _pick_time(local.get(field), backup.get(field), latest=pick_latest)
    if "time_spent_seconds" in local or "time_spent_seconds" in backup:
        out["time_spent_seconds"] = max(
            _int(local, "time_spent_seconds"), _int(backup, "time_spent_seconds")
        )
    return out


def _completions(row: Mapping[str, Any]) -> int:
    return max(_int(row, "attempts"), 1 if row.get("status") == "completed" else 0)


def _int(row: Mapping[str, Any], field: str) -> int:
    value = row.get(field)
    return int(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0


def _pct(row: Mapping[str, Any]) -> float:
    total = _int(row, "best_score_total")
    return _int(row, "best_score_correct") / total if total else -1.0


def _history(row: Mapping[str, Any]) -> list[dict[str, Any]]:
    value = _json(row.get("attempt_history"))
    return [entry for entry in value if isinstance(entry, dict)] if isinstance(value, list) else []


def _joined_history(local: Mapping[str, Any], backup: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Both histories, one entry per ``at`` (the local one on a tie), oldest first."""
    by_at: dict[str, dict[str, Any]] = {}
    for entry in _history(backup) + _history(local):
        by_at[str(entry.get("at"))] = entry
    ordered = sorted(
        by_at.values(), key=lambda entry: _ts(entry.get("at")) or datetime.min.replace(tzinfo=UTC)
    )
    return ordered[-ATTEMPT_HISTORY_CAP:]


def _pick_time(local: Any, backup: Any, *, latest: bool) -> Any:
    """The later (or earlier) of two timestamps, as the side wrote it; None loses."""
    local_ts, backup_ts = _ts(local), _ts(backup)
    if backup_ts is None:
        return local
    if local_ts is None:
        return backup
    return backup if (backup_ts > local_ts if latest else backup_ts < local_ts) else local


def _ts(value: Any) -> datetime | None:
    """A timestamp as an aware datetime; a naive one is UTC; unreadable is None."""
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
    else:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def _json(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return value
    return value


def _norm(field: str, value: Any) -> Any:
    """A value in the form two rows are compared in (parsed JSON, aware times)."""
    if field in _JSON_FIELDS:
        return _json(value)
    if field in _TIME_FIELDS:
        parsed = _ts(value)
        return parsed if parsed is not None else value
    return value
