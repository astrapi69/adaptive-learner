/**
 * Sync persistence layer (#1795 — extracted from sync-engine.ts).
 *
 * The localStorage-backed pairing config, the per-device last-sync
 * timestamp, and the 5-entry sync history the Settings panel shows.
 * Every accessor swallows storage failures (private mode) — sync is
 * a convenience layer and must never crash the app over storage.
 */

// ----- Persistence ----------------------------------------------------

const KEY_CONFIG = "adaptive-learner.sync.config";
const KEY_LAST_SYNC = "adaptive-learner.sync.last_sync_at";
const KEY_HISTORY = "adaptive-learner.sync.history";

export interface SyncConfig {
    /** Backend host (IP or hostname). */
    host: string;
    /** Backend port (default 18001). */
    port: number;
    /** The paired user_id; both devices share this after pair. */
    user_id: string;
    /** Cached display name for the Settings UI. */
    user_name: string;
    /** When pairing succeeded (ISO 8601). */
    paired_at: string;
    /** Optional friendly device label the user assigned. */
    device_name?: string;
}

export interface SyncHistoryEntry {
    at: string;
    success: boolean;
    pushed: number;
    pulled: number;
    conflicts: number;
    summary: string;
}

export function readSyncConfig(): SyncConfig | null {
    try {
        const raw = localStorage.getItem(KEY_CONFIG);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (
            parsed &&
            typeof parsed === "object" &&
            typeof parsed.host === "string" &&
            typeof parsed.port === "number" &&
            typeof parsed.user_id === "string"
        ) {
            return parsed as SyncConfig;
        }
        return null;
    } catch {
        return null;
    }
}

export function writeSyncConfig(config: SyncConfig | null): void {
    try {
        if (config === null) {
            localStorage.removeItem(KEY_CONFIG);
        } else {
            localStorage.setItem(KEY_CONFIG, JSON.stringify(config));
        }
    } catch {
        /* no-op; localStorage unavailable */
    }
}

export function readLastSyncAt(): string | null {
    try {
        return localStorage.getItem(KEY_LAST_SYNC);
    } catch {
        return null;
    }
}

export function writeLastSyncAt(iso: string | null): void {
    try {
        if (iso === null) {
            localStorage.removeItem(KEY_LAST_SYNC);
        } else {
            localStorage.setItem(KEY_LAST_SYNC, iso);
        }
    } catch {
        /* no-op */
    }
}

export function readSyncHistory(): SyncHistoryEntry[] {
    try {
        const raw = localStorage.getItem(KEY_HISTORY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as SyncHistoryEntry[]) : [];
    } catch {
        return [];
    }
}

export function appendSyncHistory(entry: SyncHistoryEntry): void {
    const history = readSyncHistory();
    history.unshift(entry);
    const trimmed = history.slice(0, 5);
    try {
        localStorage.setItem(KEY_HISTORY, JSON.stringify(trimmed));
    } catch {
        /* no-op */
    }
}

/** Drop the stored sync history (used by unpair). */
export function clearSyncHistory(): void {
    try {
        localStorage.removeItem(KEY_HISTORY);
    } catch {
        /* no-op */
    }
}
