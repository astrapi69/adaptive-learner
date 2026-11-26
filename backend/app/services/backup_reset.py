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


def _is_reset_table(table: str) -> bool:
    """Whether a reset makes this table's rows exactly the backup's."""
    if table in KEPT_TABLES or table in SYNC_SECRET_TABLES:
        return False
    return TABLES[table].scope != "global"


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
    written before the table existed says nothing about it). One limit to
    the last: a row that hangs below a deleted row goes with it, whether
    the backup carries its table or not; a child cannot outlive its parent.

    Runs in the caller's transaction, children before parents, and flushes
    per table, so that the rows of a table without an ORM relationship to
    its parent are deleted in the database before the parent is.

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
        if not _is_reset_table(table):
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


def rows_differing_from_backup(
    repo: BackupRepository,
    data: dict[str, Any],
    user_id: str,
    restore_order: Sequence[str],
) -> str | None:
    """Name the first table whose rows are not exactly the backup's, else None.

    The check a reset runs before it commits. Pruning and writing follow
    rules made for the merge, which skips a row without an error when it
    is another learner's. On an installation where two learners hold the
    same row ids (one restored the other's backup) the reset would then
    delete the learner's own rows and not bring the backup's back, or
    overwrite a row of the other learner. Whatever the cause: when the
    learner's rows are not the backup's rows afterwards, the reset is not
    applied.

    Args:
        repo: Backup repository over the restore's session, flushed.
        data: The backup's tables, already re-homed onto ``user_id``.
        user_id: The learner the restore runs for.
        restore_order: The tables, parents before children.
    """
    for table in restore_order:
        if not _is_reset_table(table):
            continue
        expected = _backup_ids(data.get(table))
        if expected is None:
            continue
        held = {row.id for row in repo.scoped_rows(table, user_id)}
        if held != expected:
            return (
                f"{table}: {len(expected - held)} row(s) of the backup could not be made "
                f"this learner's and {len(held - expected)} row(s) outside it remained"
            )
    return None


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
        """Put the staged sets in the cache's place; the old cache is kept aside.

        Renames, never moves: a rename onto a directory that a content
        request recreated meanwhile replaces an empty one and fails on a
        filled one, where a move would put the sets inside it.

        Raises:
            OSError: The sets could not be put in place; the cache is as
                it was.
        """
        if self.root.exists():
            self.root.rename(self._replaced)
        try:
            self.staging.rename(self.root)
        except OSError:
            self.swap_back()
            raise

    def swap_back(self) -> None:
        """Undo :meth:`swap_in`: the cache is as it was before."""
        shutil.rmtree(self.root, ignore_errors=True)
        if self._replaced.exists():
            self._replaced.rename(self.root)

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
    # Leftovers of a reset that was interrupted. A cache put aside while
    # no cache is in place is the only copy: it goes back, it is not deleted.
    shutil.rmtree(staging, ignore_errors=True)
    replaced = root.with_name(root.name + _REPLACED_SUFFIX)
    if replaced.exists() and not root.exists():
        replaced.rename(root)
    shutil.rmtree(replaced, ignore_errors=True)
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
    "rows_differing_from_backup",
    "stage_content_reset",
]
