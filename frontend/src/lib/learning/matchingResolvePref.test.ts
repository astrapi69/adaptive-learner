/**
 * Tests for the Matching "Auflösen" effect preference (#824).
 */

import {afterEach, describe, expect, it, vi} from "vitest";

import {
    DEFAULT_RESOLVE_EFFECT,
    MATCHING_RESOLVE_EFFECT_OPTIONS,
    MATCHING_RESOLVE_PREF_CHANGE_EVENT,
    readMatchingResolveEffect,
    writeMatchingResolveEffect,
} from "./matchingResolvePref";

afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("matchingResolvePref", () => {
    it("defaults to 'slide' when unset", () => {
        expect(readMatchingResolveEffect()).toBe(DEFAULT_RESOLVE_EFFECT);
        expect(DEFAULT_RESOLVE_EFFECT).toBe("slide");
    });

    it("round-trips every valid effect", () => {
        for (const effect of MATCHING_RESOLVE_EFFECT_OPTIONS) {
            writeMatchingResolveEffect(effect);
            expect(readMatchingResolveEffect()).toBe(effect);
        }
    });

    it("falls back to the default for an unrecognised stored value", () => {
        localStorage.setItem("adaptive-learner.matching.resolve_effect", "bogus");
        expect(readMatchingResolveEffect()).toBe(DEFAULT_RESOLVE_EFFECT);
    });

    it("dispatches a change event so open surfaces react live", () => {
        const listener = vi.fn();
        window.addEventListener(MATCHING_RESOLVE_PREF_CHANGE_EVENT, listener);
        writeMatchingResolveEffect("connect");
        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener(MATCHING_RESOLVE_PREF_CHANGE_EVENT, listener);
    });

    it("exposes all four effects as options", () => {
        expect([...MATCHING_RESOLVE_EFFECT_OPTIONS]).toEqual([
            "slide",
            "color",
            "connect",
            "stack",
        ]);
    });
});
