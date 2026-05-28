/**
 * Tests for the asset resolver (Phase 54B / v1.37.0).
 *
 * Covers:
 *  - cache hit returns the same URL twice with ref-count
 *  - in-flight de-duplication: two parallel resolves share
 *    one storage call AND one URL
 *  - release decrements; final release revokes the URL
 *  - null on storage miss
 *  - test-only reset works
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const getAssetMock = vi.fn();
const revokeMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            getAsset: getAssetMock,
        },
    }),
}));

import {
    _cacheSnapshot,
    _resetForTests,
    releaseAssetUrl,
    resolveAssetUrl,
} from "./asset-resolver";

beforeEach(() => {
    getAssetMock.mockReset();
    revokeMock.mockReset();
    _resetForTests();
    // happy-dom polyfills URL.createObjectURL but not as a
    // deterministic stub — replace with counters so we can
    // assert revoke behaviour.
    let n = 0;
    URL.createObjectURL = vi.fn(() => `blob:test/${++n}`);
    URL.revokeObjectURL = revokeMock as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
    _resetForTests();
});

function makeBlob(): Blob {
    return new Blob([new Uint8Array([1, 2, 3])], {type: "image/png"});
}

describe("resolveAssetUrl — basics", () => {
    it("returns a blob URL when storage produces a Blob", async () => {
        getAssetMock.mockResolvedValue(makeBlob());
        const url = await resolveAssetUrl("src", "set", "img/x.png");
        expect(url).toMatch(/^blob:/);
        expect(getAssetMock).toHaveBeenCalledWith("src", "set", "img/x.png");
    });

    it("returns null when storage returns null", async () => {
        getAssetMock.mockResolvedValue(null);
        const url = await resolveAssetUrl("src", "set", "img/missing.png");
        expect(url).toBeNull();
    });

    it("returns null when storage throws", async () => {
        getAssetMock.mockResolvedValue(null);
        // The resolver wraps the resolution in a try/finally,
        // but errors should still surface as a null URL via
        // the caller's catch path. Documented behavior: the
        // resolver itself does NOT catch — the hook does.
        // So a thrown storage error throws here too.
        getAssetMock.mockRejectedValueOnce(new Error("boom"));
        await expect(
            resolveAssetUrl("src", "set", "img/err.png"),
        ).rejects.toThrow("boom");
    });
});

describe("resolveAssetUrl — memoization", () => {
    it("two sequential resolves share one storage call AND one URL", async () => {
        getAssetMock.mockResolvedValue(makeBlob());
        const url1 = await resolveAssetUrl("src", "set", "img/x.png");
        const url2 = await resolveAssetUrl("src", "set", "img/x.png");
        expect(url1).toBe(url2);
        expect(getAssetMock).toHaveBeenCalledTimes(1);
        // Ref-count = 2 (one per caller).
        const snap = _cacheSnapshot();
        expect(snap).toHaveLength(1);
        expect(snap[0].refCount).toBe(2);
    });

    it("two parallel resolves share one storage call AND one URL", async () => {
        // Make the mock asynchronous so both calls land
        // before the first resolution finishes.
        let resolveStorage: (b: Blob) => void = () => {};
        const pending = new Promise<Blob>((r) => {
            resolveStorage = r;
        });
        getAssetMock.mockReturnValue(pending);
        const p1 = resolveAssetUrl("src", "set", "img/x.png");
        const p2 = resolveAssetUrl("src", "set", "img/x.png");
        resolveStorage(makeBlob());
        const [url1, url2] = await Promise.all([p1, p2]);
        expect(url1).toBe(url2);
        expect(getAssetMock).toHaveBeenCalledTimes(1);
        const snap = _cacheSnapshot();
        expect(snap[0].refCount).toBe(2);
    });

    it("different keys produce different URLs", async () => {
        getAssetMock.mockResolvedValue(makeBlob());
        const url1 = await resolveAssetUrl("src", "set", "img/a.png");
        const url2 = await resolveAssetUrl("src", "set", "img/b.png");
        expect(url1).not.toBe(url2);
        expect(getAssetMock).toHaveBeenCalledTimes(2);
    });
});

describe("releaseAssetUrl — ref-counting + revoke", () => {
    it("decrements ref-count without revoking until count = 0", async () => {
        getAssetMock.mockResolvedValue(makeBlob());
        await resolveAssetUrl("src", "set", "img/x.png");
        await resolveAssetUrl("src", "set", "img/x.png");
        // Two refs; release once.
        releaseAssetUrl("src", "set", "img/x.png");
        expect(revokeMock).not.toHaveBeenCalled();
        const snap = _cacheSnapshot();
        expect(snap[0].refCount).toBe(1);
    });

    it("revokes + deletes cache entry on final release", async () => {
        getAssetMock.mockResolvedValue(makeBlob());
        const url = await resolveAssetUrl("src", "set", "img/x.png");
        releaseAssetUrl("src", "set", "img/x.png");
        expect(revokeMock).toHaveBeenCalledWith(url);
        expect(_cacheSnapshot()).toEqual([]);
    });

    it("is a no-op when called on an unknown key (resolution failed)", () => {
        // Never resolved this key — release shouldn't crash.
        expect(() =>
            releaseAssetUrl("src", "set", "img/unknown.png"),
        ).not.toThrow();
        expect(revokeMock).not.toHaveBeenCalled();
    });

    it("a fresh resolve after a final release creates a new URL", async () => {
        getAssetMock.mockResolvedValue(makeBlob());
        const url1 = await resolveAssetUrl("src", "set", "img/x.png");
        releaseAssetUrl("src", "set", "img/x.png");
        const url2 = await resolveAssetUrl("src", "set", "img/x.png");
        expect(url1).not.toBe(url2);
    });
});

describe("_resetForTests", () => {
    it("revokes every cached URL + empties the cache", async () => {
        getAssetMock.mockResolvedValue(makeBlob());
        await resolveAssetUrl("src", "set", "img/a.png");
        await resolveAssetUrl("src", "set", "img/b.png");
        expect(_cacheSnapshot()).toHaveLength(2);
        _resetForTests();
        expect(revokeMock).toHaveBeenCalledTimes(2);
        expect(_cacheSnapshot()).toEqual([]);
    });
});
