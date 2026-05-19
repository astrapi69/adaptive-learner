/**
 * Storage layer factory + public exports (Phase 10A).
 *
 * Pages and components import ``getStorage()`` and use the
 * returned ``IStorageService``. The factory decides between
 * ApiStorage and DexieStorage at first call:
 *
 *   1. ``localStorage["adaptive-learner.storage_mode"]`` — if the
 *      user has explicitly chosen a mode in Settings, honour it.
 *   2. Build-time ``VITE_STORAGE_MODE`` — set by the GH Pages
 *      build to ``"dexie"``. Empty / unset means auto-pick.
 *   3. Auto-pick: if ``VITE_API_BASE`` is set to a non-empty
 *      absolute URL OR the build is running in local dev (the
 *      default ``/api`` proxy), use ApiStorage. Otherwise use
 *      DexieStorage (10B+; until then auto-pick still resolves
 *      to ApiStorage).
 *
 * The picked instance is cached for the lifetime of the page so
 * repeated ``getStorage()`` calls return the same object — Dexie
 * connections are expensive to reopen.
 */

import {apiStorage} from "./api-storage";
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
export function resolveStorageMode(): StorageMode {
    return readPersistedMode() ?? readBuildTimeMode() ?? "api";
}

let cachedStorage: IStorageService | null = null;

/**
 * Lazy-cached factory. The first call picks the implementation;
 * subsequent calls return the same instance.
 */
export function getStorage(): IStorageService {
    if (cachedStorage !== null) return cachedStorage;
    const mode = resolveStorageMode();
    if (mode === "dexie") {
        // DexieStorage lands in 10B. Until then auto-pick falls
        // back to apiStorage so the build doesn't break and the
        // existing user flow stays intact.
        cachedStorage = apiStorage;
    } else {
        cachedStorage = apiStorage;
    }
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

export type {IStorageService, StorageMode} from "./types";
export {apiStorage} from "./api-storage";
