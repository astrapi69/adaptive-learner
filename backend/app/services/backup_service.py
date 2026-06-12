"""Backup orchestration facade.

The export pipeline lives in :mod:`backup_export`, the restore pipeline in
:mod:`backup_restore`; this module re-exports their public entry points
(plus the backup-surface constants) so callers keep importing from
``app.services.backup_service``.
"""

from app.services.sync_service import TABLES as SYNC_TABLES

from .backup_export import (
    BACKUP_FORMAT,
    BACKUP_VERSION,
    EXCLUDED_USER_SETTINGS_FIELDS,
    create_backup,
    get_backup_stats,
)
from .backup_restore import _RESTORE_ORDER, restore_backup

# The backup surface IS the sync surface. Deriving from one source is what
# keeps export and restore from drifting (the original BACKUP-API-RESTORE-01
# bug).
ALL_BACKUP_TABLES: tuple[str, ...] = tuple(SYNC_TABLES.keys())

__all__ = [
    "ALL_BACKUP_TABLES",
    "BACKUP_FORMAT",
    "BACKUP_VERSION",
    "EXCLUDED_USER_SETTINGS_FIELDS",
    "_RESTORE_ORDER",
    "create_backup",
    "get_backup_stats",
    "restore_backup",
]
