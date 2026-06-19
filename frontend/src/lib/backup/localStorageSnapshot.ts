/**
 * localStorage snapshot for backups (P1 offline-parity, Teil A).
 *
 * The `.alb`/`.json` backup covers the IndexedDB / SQLite tables, but a
 * large class of persistent user data lives in `localStorage` and was NOT
 * portable: contributions + contributor name, every voice / feedback /
 * gamification-notification / reminder / hint / review preference, the
 * learning-direction strategy, source languages, Curriculum-Builder custom
 * paths, etc. On a browser reset or a device migration these were lost.
 *
 * This module captures a flat `{key: value}` snapshot of the app's
 * `localStorage` (the `adaptive-learner.` namespace) into the backup
 * payload on export, and writes it back on import. It is the single place
 * that decides what is and isn't safe to carry — secrets are NEVER
 * snapshotted, in either direction.
 *
 * Both storage modes use this: the frontend always has `localStorage`, so
 * the snapshot rides in the `BackupPayload` regardless of whether the
 * payload itself came from the backend (API mode) or Dexie.
 */

/**
 * Substring patterns (case-insensitive) whose `localStorage` keys are
 * NEVER written into a backup and NEVER applied on import.
 *
 *  - `github_token` / `content_repo_token`: credentials, deliberately kept
 *    out of the exportable config (EXP-023).
 *  - `api_key` / `apikey` / `secret` / `password`: any key material.
 *  - `storage_mode`: a per-DEVICE boot setting, not user learning data —
 *    restoring it across devices/modes could force a storage mode the
 *    target can't serve (e.g. API mode onto a PWA-only install).
 */
export const BACKUP_EXCLUDED_LOCALSTORAGE_PATTERNS: readonly string[] = [
    "github_token",
    "content_repo_token",
    "api_key",
    "apikey",
    "secret",
    "password",
    "storage_mode",
];

/** App namespace — only our own keys are snapshotted, never third-party. */
const APP_PREFIX = "adaptive-learner.";

/** True when a key must be excluded from backup/restore (a secret or a
 *  device-local boot setting). Case-insensitive substring match. */
export function isExcludedLocalStorageKey(key: string): boolean {
    const lower = key.toLowerCase();
    return BACKUP_EXCLUDED_LOCALSTORAGE_PATTERNS.some((pattern) =>
        lower.includes(pattern),
    );
}

/**
 * Capture every backup-eligible `localStorage` entry as a flat record.
 * Only `adaptive-learner.`-namespaced keys are included, and the secret /
 * device-local exclusions are applied. Never throws (a locked-down
 * `localStorage` yields an empty snapshot).
 */
export function captureLocalStorageSnapshot(): Record<string, string> {
    const snapshot: Record<string, string> = {};
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key === null) continue;
            if (!key.startsWith(APP_PREFIX)) continue;
            if (isExcludedLocalStorageKey(key)) continue;
            const value = localStorage.getItem(key);
            if (value !== null) snapshot[key] = value;
        }
    } catch {
        /* localStorage unavailable — return whatever was collected */
    }
    return snapshot;
}

/**
 * Write a snapshot back into `localStorage`, overwriting existing values
 * (the backup is the source of truth). The same exclusion filter is
 * re-applied here as defense-in-depth, so a hand-edited backup that smuggled
 * a secret key cannot inject it. Returns the number of keys applied. Never
 * throws.
 *
 * @param snapshot - The `local_storage` block from a backup payload, or
 *   `undefined`/`null` for a legacy backup (then this is a no-op).
 */
export function applyLocalStorageSnapshot(
    snapshot: Record<string, string> | undefined | null,
): number {
    if (snapshot === null || snapshot === undefined || typeof snapshot !== "object") {
        return 0;
    }
    let applied = 0;
    try {
        for (const [key, value] of Object.entries(snapshot)) {
            if (typeof key !== "string" || typeof value !== "string") continue;
            if (!key.startsWith(APP_PREFIX)) continue;
            if (isExcludedLocalStorageKey(key)) continue;
            localStorage.setItem(key, value);
            applied++;
        }
    } catch {
        /* localStorage unavailable — partial apply is acceptable */
    }
    return applied;
}

/**
 * Return a copy of `payload` with a fresh `local_storage` snapshot
 * attached. Used by the full-backup export paths so the downloaded
 * `.alb`/`.json` carries the user's preferences + contributions.
 */
export function withLocalStorageSnapshot<
    T extends {local_storage?: Record<string, string>},
>(payload: T): T {
    return {...payload, local_storage: captureLocalStorageSnapshot()};
}
