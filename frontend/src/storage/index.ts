/**
 * Storage layer factory + public exports (Phase 10A).
 *
 * Pages and components import ``getStorage()`` and use the
 * returned ``IStorageService``. The factory decides between
 * ApiStorage and DexieStorage at first call:
 *
 *   0. Build-time ``VITE_STORAGE_MODE === "dexie"`` — the GH Pages
 *      build is a Dexie-ONLY deployment with NO backend. This is a
 *      hard fact about the deployment, so it wins over everything
 *      else: a stale persisted ``"api"`` preference (from the
 *      Settings toggle, carried in localStorage shared with the
 *      installed PWA) can never be satisfied there and would make
 *      every request 404 (#907).
 *   1. ``localStorage["adaptive-learner.storage_mode"]`` — if the
 *      user has explicitly chosen a mode in Settings, honour it.
 *      Only consulted when the build is NOT a dexie-only build.
 *   2. Build-time ``VITE_STORAGE_MODE`` — set by the GH Pages
 *      build to ``"dexie"``. Empty / unset means auto-pick.
 *   3. Auto-pick: fall back to ApiStorage (local dev default).
 *
 * The picked instance is cached for the lifetime of the page so
 * repeated ``getStorage()`` calls return the same object — Dexie
 * connections are expensive to reopen.
 */

import {apiStorage} from "./api-storage";
import {getDb} from "./dexie/db";
import {dexieStorage} from "./dexie-storage";
import type {IStorageService, StorageMode} from "./types";

const STORAGE_MODE_KEY = "adaptive-learner.storage_mode";

/**
 * Read the user's persisted storage-mode preference. Returns
 * ``null`` when nothing is stored. Falls back gracefully if
 * ``localStorage`` is unavailable (SSR, locked-down iframes).
 */
function readPersistedMode(): StorageMode | null {
    try {
        const raw = localStorage.getItem(STORAGE_MODE_KEY);
        if (raw === "api" || raw === "dexie") return raw;
        return null;
    } catch {
        return null;
    }
}

/**
 * Persist the user's storage-mode pick. Settings calls this when
 * the user flips the toggle. Reload required to pick up the new
 * backend (live-swap is not in scope for v0.7.0).
 */
export function setPersistedStorageMode(mode: StorageMode): void {
    try {
        localStorage.setItem(STORAGE_MODE_KEY, mode);
    } catch {
        /* localStorage unavailable — silent no-op */
    }
}

/**
 * Build-time default. The GH Pages workflow sets
 * ``VITE_STORAGE_MODE=dexie``; local dev leaves it empty.
 */
function readBuildTimeMode(): StorageMode | null {
    const raw = (import.meta.env.VITE_STORAGE_MODE as string | undefined) ?? "";
    if (raw === "api" || raw === "dexie") return raw;
    return null;
}

/**
 * Resolve the storage mode that should be used right now.
 * Exported for Settings UI ("Current mode: …") and tests.
 */
/**
 * True when this is a Dexie-ONLY deployment (the GH Pages / installed-PWA
 * build, ``VITE_STORAGE_MODE === "dexie"``). There is no backend, so the
 * storage-mode choice does not exist — the Settings toggle is hidden and the
 * mode is forced to ``"dexie"`` regardless of any persisted preference (#907).
 */
export function isDexieOnlyBuild(): boolean {
    return readBuildTimeMode() === "dexie";
}

export function resolveStorageMode(): StorageMode {
    const buildTime = readBuildTimeMode();
    // A dexie-only deployment (GH Pages / installed PWA) has no backend, so the
    // build-time mode is authoritative — a stale persisted "api" preference
    // cannot be honoured there and would 404 every request (#907).
    if (buildTime === "dexie") return "dexie";
    return readPersistedMode() ?? buildTime ?? "api";
}

let cachedStorage: IStorageService | null = null;

/**
 * Lazy-cached factory. The first call picks the implementation;
 * subsequent calls return the same instance.
 */
export function getStorage(): IStorageService {
    if (cachedStorage !== null) return cachedStorage;
    const mode = resolveStorageMode();
    cachedStorage = mode === "dexie" ? dexieStorage : apiStorage;
    return cachedStorage;
}

/**
 * Test-only hook: reset the cached storage so a subsequent
 * ``getStorage()`` re-resolves the mode. Production code MUST
 * NOT call this — toggling modes at runtime is intentionally
 * out of scope (the Settings UI persists + reloads instead).
 */
export function _resetStorageCacheForTests(): void {
    cachedStorage = null;
}

/**
 * Per-table row counts for the Settings UI "Storage mode" panel.
 * Reads the live Dexie database; ApiStorage mode returns an empty
 * map (counting backend rows from the browser is not in scope).
 */
export async function getStorageRowCounts(): Promise<Record<string, number>> {
    const mode = resolveStorageMode();
    if (mode !== "dexie") return {};
    const db = getDb();
    return {
        users: await db.users.count(),
        learningProjects: await db.learningProjects.count(),
        learningProfiles: await db.learningProfiles.count(),
        curricula: await db.curricula.count(),
        learningTopics: await db.learningTopics.count(),
        lessons: await db.lessons.count(),
        learningSessions: await db.learningSessions.count(),
        sessionMessages: await db.sessionMessages.count(),
        sessionRatings: await db.sessionRatings.count(),
        progressCommits: await db.progressCommits.count(),
        stepEvaluations: await db.stepEvaluations.count(),
        methodSwitches: await db.methodSwitches.count(),
    };
}

export type {IStorageService, StorageMode} from "./types";
export {apiStorage} from "./api-storage";
export {dexieStorage} from "./dexie-storage";
