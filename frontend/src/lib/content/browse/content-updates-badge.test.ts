/**
 * Tests for the session-cached content-update count (#2904).
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const listSetsMock = vi.fn();

vi.mock("../../../storage", () => ({
    getStorage: () => ({contentLoader: {listSets: listSetsMock}}),
}));

import {
    _resetContentUpdateCountForTests,
    CONTENT_UPDATES_CHANGED_EVENT,
    getContentUpdateCount,
    invalidateContentUpdateCount,
} from "./content-updates-badge";

function set(id: string, updateAvailable: boolean) {
    return {source: "owner/repo", id, update_available: updateAvailable};
}

beforeEach(() => {
    listSetsMock.mockReset();
    _resetContentUpdateCountForTests();
});

afterEach(() => {
    _resetContentUpdateCountForTests();
});

describe("getContentUpdateCount", () => {
    it("counts only sets with update_available", async () => {
        listSetsMock.mockResolvedValueOnce({
            sets: [set("a", true), set("b", false), set("c", true)],
        });
        expect(await getContentUpdateCount()).toBe(2);
    });

    it("returns 0 when nothing has an update", async () => {
        listSetsMock.mockResolvedValueOnce({sets: [set("a", false)]});
        expect(await getContentUpdateCount()).toBe(0);
    });

    it("caches the result for the session — a second call does not re-fetch", async () => {
        listSetsMock.mockResolvedValueOnce({sets: [set("a", true)]});
        expect(await getContentUpdateCount()).toBe(1);
        expect(await getContentUpdateCount()).toBe(1);
        expect(listSetsMock).toHaveBeenCalledTimes(1);
    });

    it("invalidate drops the session cache - the next call re-fetches (#2985)", async () => {
        listSetsMock.mockResolvedValueOnce({sets: [set("a", true), set("b", true)]});
        expect(await getContentUpdateCount()).toBe(2);
        invalidateContentUpdateCount();
        // The learner applied both updates; the fresh fetch must be believed.
        listSetsMock.mockResolvedValueOnce({sets: [set("a", false), set("b", false)]});
        expect(await getContentUpdateCount()).toBe(0);
        expect(listSetsMock).toHaveBeenCalledTimes(2);
    });

    it("invalidate announces the change via a window event (#2985)", () => {
        const listener = vi.fn();
        window.addEventListener(CONTENT_UPDATES_CHANGED_EVENT, listener);
        try {
            invalidateContentUpdateCount();
            expect(listener).toHaveBeenCalledTimes(1);
        } finally {
            window.removeEventListener(CONTENT_UPDATES_CHANGED_EVENT, listener);
        }
    });

    it("a fetch in flight at invalidation time cannot poison the fresh cache (#2985)", async () => {
        let resolve!: (v: {sets: unknown[]}) => void;
        listSetsMock.mockReturnValueOnce(
            new Promise((r) => {
                resolve = r;
            }),
        );
        const stale = getContentUpdateCount();
        invalidateContentUpdateCount();
        resolve({sets: [set("a", true), set("b", true)]});
        await stale;
        // The stale in-flight result must not have been cached.
        listSetsMock.mockResolvedValueOnce({sets: [set("a", false), set("b", false)]});
        expect(await getContentUpdateCount()).toBe(0);
    });

    it("shares one in-flight fetch across concurrent callers", async () => {
        let resolve!: (v: {sets: unknown[]}) => void;
        listSetsMock.mockReturnValueOnce(
            new Promise((r) => {
                resolve = r;
            }),
        );
        const first = getContentUpdateCount();
        const second = getContentUpdateCount();
        resolve({sets: [set("a", true), set("b", true)]});
        expect(await first).toBe(2);
        expect(await second).toBe(2);
        expect(listSetsMock).toHaveBeenCalledTimes(1);
    });
});
