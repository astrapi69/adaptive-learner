import {describe, expect, it} from "vitest";

import {isChunkLoadError, shouldReloadForChunkError} from "./lazyWithReload";

describe("isChunkLoadError", () => {
    it("matches the dynamic-import fetch failures across browsers", () => {
        for (const message of [
            "Failed to fetch dynamically imported module: https://x/assets/Settings-BYpvqc3a.js",
            "error loading dynamically imported module",
            "Importing a module script failed.",
            "ChunkLoadError: Loading chunk 5 failed.",
        ]) {
            expect(isChunkLoadError(new Error(message)), message).toBe(true);
        }
    });

    it("ignores unrelated errors", () => {
        expect(isChunkLoadError(new Error("Cannot read properties of null"))).toBe(
            false,
        );
        expect(isChunkLoadError(new TypeError("x is not a function"))).toBe(false);
        expect(isChunkLoadError("some string")).toBe(false);
        expect(isChunkLoadError(null)).toBe(false);
    });
});

describe("shouldReloadForChunkError", () => {
    const chunkErr = new Error("Failed to fetch dynamically imported module");

    it("reloads once on a chunk error", () => {
        expect(shouldReloadForChunkError(chunkErr, false)).toBe(true);
    });

    it("does not reload again after one reload (loop guard)", () => {
        expect(shouldReloadForChunkError(chunkErr, true)).toBe(false);
    });

    it("never reloads for a non-chunk error", () => {
        expect(shouldReloadForChunkError(new Error("boom"), false)).toBe(false);
    });
});
