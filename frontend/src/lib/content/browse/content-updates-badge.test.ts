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
    getContentUpdateCount,
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
