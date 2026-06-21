/**
 * Tests for the useAsset hook (Phase 54B / v1.37.0).
 *
 * Covers:
 *  - loading → ready transition when storage resolves a Blob
 *  - error state when storage returns null
 *  - argument-empty short-circuit (no fetch fires)
 *  - cleanup on unmount releases the resolver ref
 *  - re-renders with the same args don't double-acquire
 */

import {renderHook, waitFor} from "@testing-library/react";
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

import {_cacheSnapshot, _resetForTests} from "../../lib/content/media/asset-resolver";
import {useAsset} from "./useAsset";

beforeEach(() => {
    getAssetMock.mockReset();
    revokeMock.mockReset();
    _resetForTests();
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

describe("useAsset — happy path", () => {
    it("transitions loading → ready with a url", async () => {
        getAssetMock.mockResolvedValue(makeBlob());
        const {result} = renderHook(() =>
            useAsset("src", "set", "img/x.png"),
        );
        expect(result.current.loading).toBe(true);
        expect(result.current.url).toBeNull();
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        expect(result.current.url).toMatch(/^blob:/);
        expect(result.current.error).toBe(false);
    });

    it("surfaces error when storage returns null", async () => {
        getAssetMock.mockResolvedValue(null);
        const {result} = renderHook(() =>
            useAsset("src", "set", "img/missing.png"),
        );
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        expect(result.current.url).toBeNull();
        expect(result.current.error).toBe(true);
    });

    it("surfaces error when storage throws", async () => {
        getAssetMock.mockRejectedValue(new Error("boom"));
        const {result} = renderHook(() =>
            useAsset("src", "set", "img/err.png"),
        );
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        expect(result.current.error).toBe(true);
    });
});

describe("useAsset — argument short-circuits", () => {
    it("skips the fetch when source is empty", async () => {
        const {result} = renderHook(() => useAsset("", "set", "img/x.png"));
        // synchronous → loading false, error true
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(true);
        expect(getAssetMock).not.toHaveBeenCalled();
    });

    it.each([
        ["src", "", "img/x.png"],
        ["src", "set", ""],
        ["src", "set", null],
        ["src", null, "img/x.png"],
        [null, "set", "img/x.png"],
    ] as Array<[string | null, string | null, string | null]>)(
        "skips the fetch when args contain null/empty",
        (source, setId, assetPath) => {
            renderHook(() => useAsset(source, setId, assetPath));
            expect(getAssetMock).not.toHaveBeenCalled();
        },
    );
});

describe("useAsset — cleanup", () => {
    it("releases the resolver ref on unmount", async () => {
        getAssetMock.mockResolvedValue(makeBlob());
        const {result, unmount} = renderHook(() =>
            useAsset("src", "set", "img/x.png"),
        );
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        expect(_cacheSnapshot()).toHaveLength(1);
        unmount();
        // Last ref → URL revoked, cache empty.
        expect(revokeMock).toHaveBeenCalled();
        expect(_cacheSnapshot()).toEqual([]);
    });

    it("only revokes after the LAST consumer unmounts", async () => {
        getAssetMock.mockResolvedValue(makeBlob());
        const h1 = renderHook(() => useAsset("src", "set", "img/x.png"));
        const h2 = renderHook(() => useAsset("src", "set", "img/x.png"));
        await waitFor(() => {
            expect(h1.result.current.loading).toBe(false);
            expect(h2.result.current.loading).toBe(false);
        });
        expect(getAssetMock).toHaveBeenCalledTimes(1); // de-duped
        expect(_cacheSnapshot()[0].refCount).toBe(2);
        h1.unmount();
        expect(revokeMock).not.toHaveBeenCalled();
        h2.unmount();
        expect(revokeMock).toHaveBeenCalled();
    });
});
