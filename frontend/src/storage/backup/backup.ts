/**
 * Backup + restore for Dexie mode (Phase 15B) — re-export hub.
 *
 * Mirrors the backend's ``backup_service.py`` byte-for-byte so the
 * same JSON file works in both directions. A Dexie-mode backup
 * loads cleanly on an API/SQLite install via ``POST /api/backup/import``
 * and vice versa. Restore semantics are MERGE, not overwrite; API
 * keys are stripped on export and ignored on import.
 *
 * Split by concern (#1806) — this module stays the import surface so
 * every consumer keeps its path:
 *
 *   - ``backup-tables``       table specs + restore order + constants
 *   - ``backup-scope``        user-scoping + row helpers
 *   - ``backup-export``       stats + payload build + content-set dump
 *   - ``backup-restore``      validation + the merge restore
 *   - ``backup-content-sets`` the #130/#134 content-cache restore
 */

export {
    BACKUP_FORMAT,
    BACKUP_VERSION,
    EXCLUDED_USER_SETTINGS_FIELDS,
} from "./backup-tables";
export {createDexieBackup, getDexieBackupStats} from "./backup-export";
export {restoreDexieBackup, validateBackupPayload} from "./backup-restore";
