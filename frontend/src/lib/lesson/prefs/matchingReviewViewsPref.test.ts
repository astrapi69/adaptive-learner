/**
 * Tests for the Matching "Corrections as a separate view" preference (#3186).
 */

import {afterEach, describe, expect, it, vi} from "vitest";

import {
    DEFAULT_MATCHING_SEPARATE_CORRECTIONS,
    MATCHING_REVIEW_VIEWS_PREF_CHANGE_EVENT,
    readMatchingSeparateCorrections,
    writeMatchingSeparateCorrections,
} from "./matchingReviewViewsPref";

const KEY = "adaptive-learner.matching.separate_corrections";

afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("matchingReviewViewsPref", () => {
    it("defaults to the three-view layout (separate corrections) when unset", () => {
        expect(DEFAULT_MATCHING_SEPARATE_CORRECTIONS).toBe(true);
        expect(readMatchingSeparateCorrections()).toBe(true);
    });

    it("round-trips both values", () => {
        writeMatchingSeparateCorrections(false);
        expect(readMatchingSeparateCorrections()).toBe(false);
        writeMatchingSeparateCorrections(true);
        expect(readMatchingSeparateCorrections()).toBe(true);
    });

    it("falls back to the default for an unrecognised stored value", () => {
        localStorage.setItem(KEY, "bogus");
        expect(readMatchingSeparateCorrections()).toBe(true);
        localStorage.setItem(KEY, "");
        expect(readMatchingSeparateCorrections()).toBe(true);
    });

    it("dispatches a change event so open exercises react live", () => {
        const listener = vi.fn();
        window.addEventListener(MATCHING_REVIEW_VIEWS_PREF_CHANGE_EVENT, listener);
        writeMatchingSeparateCorrections(false);
        window.removeEventListener(MATCHING_REVIEW_VIEWS_PREF_CHANGE_EVENT, listener);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("returns the default when storage throws", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("denied");
        });
        expect(readMatchingSeparateCorrections()).toBe(true);
    });

    it("swallows a storage failure on write", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("quota");
        });
        expect(() => writeMatchingSeparateCorrections(false)).not.toThrow();
    });
});
