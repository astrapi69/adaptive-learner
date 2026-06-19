/**
 * Tests for useCountUp (EXP-008 / Phase 55C).
 *
 * Pins the instant paths (the ones that matter for correctness):
 *  - reduced motion -> jump straight to target,
 *  - disabled -> jump straight to target,
 *  - target <= 0 -> target,
 *  - enabled + motion-allowed -> starts at 0 (then animates).
 */

import {renderHook} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import {useCountUp} from "./useCountUp";

function stubMatchMedia(matches: boolean) {
    vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({
            matches,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })),
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("useCountUp", () => {
    it("jumps to target under reduced motion", () => {
        stubMatchMedia(true);
        const {result} = renderHook(() => useCountUp(87, 1000, true));
        expect(result.current).toBe(87);
    });

    it("jumps to target when disabled", () => {
        stubMatchMedia(false);
        const {result} = renderHook(() => useCountUp(87, 1000, false));
        expect(result.current).toBe(87);
    });

    it("returns target immediately when target <= 0", () => {
        stubMatchMedia(false);
        const {result} = renderHook(() => useCountUp(0, 1000, true));
        expect(result.current).toBe(0);
    });

    it("starts at 0 when animating", () => {
        stubMatchMedia(false);
        const {result} = renderHook(() => useCountUp(87, 1000, true));
        expect(result.current).toBe(0);
    });
});
