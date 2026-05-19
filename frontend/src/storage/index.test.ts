/**
 * Storage factory tests (Phase 10A).
 *
 * Pins the mode-resolution chain and the per-page caching
 * behaviour. The cache is exercised via the ``_resetStorageCacheForTests``
 * test hook.
 */

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
    _resetStorageCacheForTests,
    getStorage,
    resolveStorageMode,
    setPersistedStorageMode,
} from "./index";

const STORAGE_KEY = "adaptive-learner.storage_mode";

beforeEach(() => {
    _resetStorageCacheForTests();
    localStorage.removeItem(STORAGE_KEY);
});

afterEach(() => {
    _resetStorageCacheForTests();
    localStorage.removeItem(STORAGE_KEY);
});

describe("resolveStorageMode", () => {
    it("defaults to 'api' when nothing is configured", () => {
        expect(resolveStorageMode()).toBe("api");
    });

    it("honours a persisted 'dexie' choice", () => {
        setPersistedStorageMode("dexie");
        expect(resolveStorageMode()).toBe("dexie");
    });

    it("honours a persisted 'api' choice", () => {
        setPersistedStorageMode("api");
        expect(resolveStorageMode()).toBe("api");
    });

    it("ignores junk localStorage values", () => {
        localStorage.setItem(STORAGE_KEY, "magic");
        expect(resolveStorageMode()).toBe("api");
    });
});

describe("getStorage caching", () => {
    it("returns the same instance on subsequent calls", () => {
        const a = getStorage();
        const b = getStorage();
        expect(b).toBe(a);
    });

    it("re-resolves after the test hook resets the cache", () => {
        const a = getStorage();
        _resetStorageCacheForTests();
        const b = getStorage();
        // Same module-level singleton ApiStorage so we still get
        // the same object back, but the cache was cleared in
        // between - this exercise pins that the helper does NOT
        // throw and produces a usable result.
        expect(a.mode).toBe("api");
        expect(b.mode).toBe("api");
    });
});
