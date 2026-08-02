/**
 * Tests for the hidden multi-tap activation gesture (#2319).
 */

import {act, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {useSecretTapGesture} from "./useSecretTapGesture";

beforeEach(() => {
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
});

function tap(result: {current: {onPointerDown: () => void}}, times: number) {
    for (let i = 0; i < times; i++) {
        act(() => result.current.onPointerDown());
    }
}

describe("useSecretTapGesture", () => {
    it("fires after the required number of taps within the window", () => {
        const onTrigger = vi.fn();
        const {result} = renderHook(() =>
            useSecretTapGesture({taps: 6, windowMs: 2000, onTrigger}),
        );
        tap(result, 5);
        expect(onTrigger).not.toHaveBeenCalled();
        tap(result, 1);
        expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it("does not fire on ordinary taps spaced beyond the window", () => {
        const onTrigger = vi.fn();
        const {result} = renderHook(() =>
            useSecretTapGesture({taps: 3, windowMs: 500, onTrigger}),
        );
        act(() => result.current.onPointerDown());
        act(() => {
            vi.advanceTimersByTime(600);
        });
        act(() => result.current.onPointerDown());
        act(() => {
            vi.advanceTimersByTime(600);
        });
        act(() => result.current.onPointerDown());
        // Each tap fell outside the window from the previous one, so the
        // count kept resetting - no accidental trigger.
        expect(onTrigger).not.toHaveBeenCalled();
    });

    it("is inert when disabled", () => {
        const onTrigger = vi.fn();
        const {result} = renderHook(() =>
            useSecretTapGesture({
                taps: 2,
                windowMs: 2000,
                onTrigger,
                enabled: false,
            }),
        );
        tap(result, 5);
        expect(onTrigger).not.toHaveBeenCalled();
    });
});
