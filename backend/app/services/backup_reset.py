"""The deleting half of a reset restore (#3787).

A restore has two modes. The merge only adds and updates. The reset brings
the installation exactly to the backup's state, so it first removes what the
backup does not hold: the learner's rows (:func:`prune_rows_not_in_backup`)
and the cached content sets (:func:`stage_content_reset`). The writing half
is the restore itself, :mod:`app.services.backup_restore`.

Browser counterpart: ``frontend/src/storage/backup/reset/reset-prune.ts``.
"""

from __future__ import annotations

import logging
import shutil
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from app.exceptions import ValidationError
from app.repositories.backup_repo import BackupRepository
from app.services.content_backup import _cache_root, _write_set
from app.services.sync_service import TABLES
from app.services.sync_tables import SYNC_SECRET_TABLES

logger = logging.getLogger(__name__)

RestoreMode = Literal["merge", "reset"]

# Tables whose rows a reset overwrites in place and never deletes: the
# learner's own ``users`` row, and the ``user_settings`` row, which carries
# the AI keys no backup holds.
KEPT_TABLES: frozenset[str] = frozenset({"users", "user_settings"})

_STAGING_SUFFIX = ".reset-new"
_REPLACED_SUFFIX = ".reset-old"


def _backup_ids(records: Any) -> set[str] | None:
    """The ids the backup holds for one table, or None when it does not carry it."""
    if not isinstance(records, list):
        return None
    return {
        record["id"]
        for record in records
        if isinstance(record, dict) and isinstance(record.get("id"), str)
    }


def prune_rows_not_in_backup(
    repo: BackupRepository,
    data: dict[str, Any],
    user_id: str,
    restore_order: Sequence[str],
) -> int:
    """Delete the learner's rows that the backup does not hold.

    Deliberately not removed: the rows of :data:`KEPT_TABLES`, the secret
    tables, the tables shared across learners, every other learner's rows,
    and the rows of a table the backup does not carry at all (a backup
    written before the table existed says nothing about it).

    Runs in the caller's transaction, children before parents, and flushes
    per table so a row the restore writes under the same unique key does
    not collide with the one deleted here.

    Args:
        repo: Backup repository over the restore's session.
        data: The backup's tables, already re-homed onto ``user_id``.
        user_id: The learner the restore runs for.
        restore_order: The tables, parents before children.

    Returns:
        How many rows were deleted.
    """
    deleted = 0
    for table in reversed(restore_order):
        if table in KEPT_TABLES or table in SYNC_SECRET_TABLES:
            continue
        if TABLES[table].scope == "global":
            continue
        keep = _backup_ids(data.get(table))
        if keep is None:
            continue
        gone = [row for row in repo.scoped_rows(table, user_id) if row.id not in keep]
        for row in gone:
            repo.delete(row)
        repo.flush()
        deleted += len(gone)
    return deleted


@dataclass(frozen=True)
class StagedContentReset:
    """The backup's content sets, written beside the cache and not yet in use.

    The cache is a directory tree, outside the database transaction. To keep
    a reset all or nothing, the sets are written to a staging directory
    first, swapped in just before the commit, and swapped back when the
    commit fails.

    Example:
        staged = stage_content_reset(payload.get("content_sets"))
        ...  # prune and write the rows
        if staged is not None:
            staged.swap_in()
        repo.commit()  # on failure: staged.swap_back()
        if staged is not None:
            staged.finish()
    """

    root: Path
    staging: Path
    count: int

    @property
    def _replaced(self) -> Path:
        return self.root.with_name(self.root.name + _REPLACED_SUFFIX)

    def swap_in(self) -> None:
        """Put the staged sets in the cache's place; the old cache is kept aside."""
        if self.root.exists():
            shutil.move(str(self.root), str(self._replaced))
        shutil.move(str(self.staging), str(self.root))

    def swap_back(self) -> None:
        """Undo :meth:`swap_in`: the cache is as it was before."""
        shutil.rmtree(self.root, ignore_errors=True)
        if self._replaced.exists():
            shutil.move(str(self._replaced), str(self.root))

    def finish(self) -> None:
        """Drop the cache that :meth:`swap_in` put aside."""
        shutil.rmtree(self._replaced, ignore_errors=True)

    def discard(self) -> None:
        """Drop the staged sets; the cache was never touched."""
        shutil.rmtree(self.staging, ignore_errors=True)


def stage_content_reset(entries: Any) -> StagedContentReset | None:
    """Write the backup's sets to a staging directory beside the cache.

    Own and downloaded sets alike: after the swap the cache holds exactly
    the backup's sets (owner decision on #3787, 2026-11-26).

    Args:
        entries: The backup's ``content_sets`` block.

    Returns:
        The staged sets, or None when the backup has no such block: it then
        says nothing about the sets, and a reset leaves them as they are.

    Raises:
        ValidationError: A set of the backup cannot be written. Nothing was
            changed.
    """
    if not isinstance(entries, list):
        return None
    root = _cache_root()
    staging = root.with_name(root.name + _STAGING_SUFFIX)
    # Leftovers of a reset that was interrupted.
    shutil.rmtree(staging, ignore_errors=True)
    shutil.rmtree(root.with_name(root.name + _REPLACED_SUFFIX), ignore_errors=True)
    staging.mkdir(parents=True)
    count = 0
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        label = f"{entry.get('source')}/{entry.get('set_id')}@v{entry.get('version')}"
        try:
            _write_set(staging, entry)
        except Exception as exc:
            shutil.rmtree(staging, ignore_errors=True)
            logger.error("Reset: content set %s cannot be written: %s", label, exc, exc_info=True)
            raise ValidationError(
                f"The reset was not applied and nothing was changed: {label}: {exc}"
            ) from exc
        count += 1
    return StagedContentReset(root=root, staging=staging, count=count)


__all__ = [
    "KEPT_TABLES",
    "RestoreMode",
    "StagedContentReset",
    "prune_rows_not_in_backup",
    "stage_content_reset",
]
