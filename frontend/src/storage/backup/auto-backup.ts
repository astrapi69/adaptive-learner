/**
 * Auto-backup rotation for Dexie mode (Phase 15D).
 *
 * Browser storage is fragile: a cache clear, a browser update, or
 * a storage-pressure eviction can wipe IndexedDB silently. We
 * mitigate by keeping a small ring of automatic backups in a
 * second IndexedDB database (``adaptive-learner-backups``) that
 * does not share a transaction surface with the live data DB.
 *
 * Schedule (in Dexie mode only):
 *
 *   - After every 10 completed sessions, OR
 *   - When >= 7 days have passed since the last auto-backup.
 *
 * Whichever fires first. Counter + last-run timestamp live in
 * localStorage; the backups themselves live in IndexedDB so they
 * survive a localStorage clear too.
 *
 * Capacity: keep the 3 most-recent entries, rotate the oldest.
 *
 * Users can disable auto-backup via ``adaptive-learner.auto_backup_enabled``.
 * Default is on when the storage mode is ``dexie``; ignored in
 * API mode (backend persistence is on durable storage already).
 */

import Dexie, {type EntityTable} from "dexie";

import {createDexieBackup, restoreDexieBackup} from "./backup";
import type {BackupPayload, RestoreSummary} from "../../types/domain";

const ENABLED_KEY = "adaptive-learner.auto_backup_enabled";
const COUNTER_KEY = "adaptive-learner.auto_backup_session_counter";
const LAST_AT_KEY = "adaptive-learner.auto_backup_last_at";

const SESSION_THRESHOLD = 10;
const TIME_THRESHOLD_DAYS = 7;
const MAX_KEEP = 3;

interface AutoBackupRow {
    id: string;
    user_id: string;
    created_at: string;
    app_version?: string;
    storage_mode: "api" | "dexie";
    total_records: number;
    payload: BackupPayload;
}

class AutoBackupDb extends Dexie {
    backups!: EntityTable<AutoBackupRow, "id">;

    constructor(name = "adaptive-learner-backups") {
        super(name);
        this.version(1).stores({backups: "id, user_id, created_at"});
    }
}

let _db: AutoBackupDb | null = null;

function getBackupDb(): AutoBackupDb {
    if (_db === null) {
        _db = new AutoBackupDb();
    }
    return _db;
}

/** Test-only: drop the cached handle so the next call opens a fresh one. */
export async function _resetAutoBackupDbForTests(): Promise<void> {
    if (_db !== null) {
        await _db.close();
        _db = null;
    }
}

/**
 * Production: empty the auto-backup ring (Phase 41F Danger Zone).
 *
 * Clears the ``backups`` table across all users in a single
 * transaction. Used by the Settings > Danger Zone reset flow to
 * scrub the auto-backup ring alongside Dexie's main stores +
 * localStorage. The cached ``_db`` handle is left in place;
 * callers that want a truly fresh DB connection (only tests
 * today) should additionally call ``_resetAutoBackupDbForTests``.
 *
 * Best-effort: a failed clear is logged but does not throw, so
 * the surrounding reset flow can continue.
 */
export async function clearAllAutoBackups(): Promise<void> {
    try {
        const db = getBackupDb();
        await db.backups.clear();
    } catch (err) {
        console.warn("auto-backup clear failed:", err);
    }
}

// ---- Preferences --------------------------------------------------------

export function isAutoBackupEnabled(): boolean {
    const raw = localStorage.getItem(ENABLED_KEY);
    if (raw === null) {
        return true; // default-on
    }
    return raw === "true";
}

export function setAutoBackupEnabled(enabled: boolean): void {
    localStorage.setItem(ENABLED_KEY, enabled ? "true" : "false");
}

function readCounter(): number {
    const raw = localStorage.getItem(COUNTER_KEY);
    if (raw === null) {
        return 0;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function writeCounter(value: number): void {
    localStorage.setItem(COUNTER_KEY, String(Math.max(0, value)));
}

function readLastAt(): string | null {
    return localStorage.getItem(LAST_AT_KEY);
}

function writeLastAt(iso: string): void {
    localStorage.setItem(LAST_AT_KEY, iso);
}

function daysSince(iso: string | null, now: Date = new Date()): number {
    if (iso === null) {
        return Number.POSITIVE_INFINITY;
    }
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) {
        return Number.POSITIVE_INFINITY;
    }
    return (now.getTime() - ms) / (24 * 60 * 60 * 1000);
}

// ---- Auto-backup engine ------------------------------------------------

interface AutoBackupTrigger {
    reason: "session-threshold" | "time-threshold" | "manual";
    counter?: number;
    days_since?: number;
}

/**
 * Run an auto-backup right now: export the user's current state,
 * insert into the ring, drop the oldest if the ring is full.
 *
 * No-op when auto-backup is disabled, except when ``trigger.reason``
 * is ``"manual"``. The Settings UI's "Backup now" button uses
 * the manual path to force a run regardless of the toggle.
 */
export async function runAutoBackupNow(
    userId: string,
    appVersion: string,
    trigger: AutoBackupTrigger = {reason: "manual"},
): Promise<AutoBackupRow> {
    if (trigger.reason !== "manual" && !isAutoBackupEnabled()) {
        throw new Error("Auto-backup is disabled.");
    }
    const payload = await createDexieBackup(userId, appVersion);
    const row: AutoBackupRow = {
        id: crypto.randomUUID(),
        user_id: userId,
        created_at: payload.created_at,
        app_version: payload.app_version,
        storage_mode: payload.storage_mode,
        total_records: payload.stats.total_records,
        payload,
    };
    const db = getBackupDb();
    await db.backups.add(row);
    await rotateAutoBackups(userId);
    writeLastAt(payload.created_at);
    writeCounter(0);
    return row;
}

/**
 * Keep the ``MAX_KEEP`` most-recent rows per user, drop the older
 * ones. Per-user scoping prevents one user's heavy use from
 * starving another's history in a future multi-user surface.
 */
export async function rotateAutoBackups(userId: string): Promise<void> {
    const db = getBackupDb();
    const rows = await db.backups
        .where("user_id")
        .equals(userId)
        .toArray();
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const stale = rows.slice(MAX_KEEP);
    for (const row of stale) {
        await db.backups.delete(row.id);
    }
}

export interface AutoBackupSummary {
    id: string;
    user_id: string;
    created_at: string;
    app_version?: string;
    storage_mode: "api" | "dexie";
    total_records: number;
}

function toSummary(row: AutoBackupRow): AutoBackupSummary {
    return {
        id: row.id,
        user_id: row.user_id,
        created_at: row.created_at,
        app_version: row.app_version,
        storage_mode: row.storage_mode,
        total_records: row.total_records,
    };
}

export async function listAutoBackups(userId: string): Promise<AutoBackupSummary[]> {
    const db = getBackupDb();
    const rows = await db.backups
        .where("user_id")
        .equals(userId)
        .toArray();
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return rows.map(toSummary);
}

export async function deleteAutoBackup(id: string): Promise<void> {
    const db = getBackupDb();
    await db.backups.delete(id);
}

/**
 * v1.12.0 / Phase 25D — fetch the full payload of one stored
 * auto-backup. Used by the auto-backup compare UI to feed a
 * snapshot into ``BackupCompare``. Returns ``null`` when the id
 * does not exist (the slot may have been rotated out between
 * the list render and the compare click).
 */
export async function getAutoBackupPayload(id: string): Promise<import("../../types/domain").BackupPayload | null> {
    const db = getBackupDb();
    const row = await db.backups.get(id);
    return row ? row.payload : null;
}

export async function restoreFromAutoBackup(
    userId: string,
    id: string,
): Promise<RestoreSummary> {
    const db = getBackupDb();
    const row = await db.backups.get(id);
    if (row === undefined) {
        throw new Error(`Auto-backup ${id} not found.`);
    }
    return restoreDexieBackup(userId, row.payload);
}

// ---- Triggers ----------------------------------------------------------

/**
 * Bump the session counter; return a trigger descriptor when the
 * threshold is crossed. Called by ``dexieStorage.session.end``.
 * Returns null when no auto-backup is due (or when auto-backup
 * is disabled).
 */
export function recordCompletedSession(): AutoBackupTrigger | null {
    if (!isAutoBackupEnabled()) {
        return null;
    }
    const next = readCounter() + 1;
    writeCounter(next);
    if (next >= SESSION_THRESHOLD) {
        return {reason: "session-threshold", counter: next};
    }
    return null;
}

/**
 * Time-based trigger check. Runs cheaply at app load. Returns a
 * trigger when ``last_at`` is older than 7 days OR has never been
 * set.
 */
export function checkTimeTrigger(now: Date = new Date()): AutoBackupTrigger | null {
    if (!isAutoBackupEnabled()) {
        return null;
    }
    const days = daysSince(readLastAt(), now);
    if (days >= TIME_THRESHOLD_DAYS) {
        return {reason: "time-threshold", days_since: days};
    }
    return null;
}

/**
 * Fire-and-forget convenience for callers that don't care about
 * the result. Errors are swallowed (logged) so a backup failure
 * never breaks the foreground flow that triggered it (e.g. ending
 * a session).
 */
export async function maybeRunAutoBackup(
    userId: string,
    appVersion: string,
    trigger: AutoBackupTrigger | null,
): Promise<AutoBackupRow | null> {
    if (trigger === null) {
        return null;
    }
    try {
        return await runAutoBackupNow(userId, appVersion, trigger);
    } catch (err) {
        console.warn("Auto-backup skipped:", err);
        return null;
    }
}

// ---- Storage pressure --------------------------------------------------

export interface StoragePressureReport {
    usage_bytes: number;
    quota_bytes: number;
    usage_ratio: number;
    is_pressured: boolean;
}

/**
 * Probe browser storage usage. Returns null when the StorageManager
 * API is unavailable (Safari + older browsers). When usage exceeds
 * 90 % of quota, ``is_pressured`` is true and the UI surfaces a
 * warning urging a manual export.
 */
export async function estimateStoragePressure(): Promise<StoragePressureReport | null> {
    if (
        typeof navigator === "undefined" ||
        navigator.storage === undefined ||
        typeof navigator.storage.estimate !== "function"
    ) {
        return null;
    }
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    const ratio = quota > 0 ? usage / quota : 0;
    return {
        usage_bytes: usage,
        quota_bytes: quota,
        usage_ratio: ratio,
        is_pressured: ratio > 0.9,
    };
}

// ---- Test helpers ------------------------------------------------------

export function _resetAutoBackupStateForTests(): void {
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(COUNTER_KEY);
    localStorage.removeItem(LAST_AT_KEY);
}
