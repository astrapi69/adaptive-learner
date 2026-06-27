/**
 * Tests for useTimedLesson (#1009): inert unless enabled, the per-question
 * limit, and the timeout path (records the question wrong, then
 * auto-advances after the pause). Uses fake timers for the countdown.
 */

import {act, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {useTimedLesson} from "./useTimedLesson";
import type {ContentLesson} from "../../../storage/types";

const LESSON: ContentLesson = {
    id: "l1",
    title: "T",
    estimated_minutes: 5,
    cards: [],
    steps: [
        {
            id: "s0",
            type: "exercise",
            exercise: {
                id: "e0",
                type: "cloze",
                prompt: "p",
                card_ids: [],
                blanks: [{answers: ["x"]}],
                distractors: [],
            },
        },
    ],
} as unknown as ContentLesson;

beforeEach(() => {
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
});

function opts(over: Record<string, unknown> = {}) {
    return {
        enabled: true,
        lesson: LESSON,
        currentStepIndex: 0,
        checked: false,
        progress: null,
        recordStepResult: vi.fn().mockResolvedValue(undefined),
        goNext: vi.fn(),
        ...over,
    };
}

describe("useTimedLesson", () => {
    it("is inert when disabled", () => {
        const {result} = renderHook(() =>
            useTimedLesson(opts({enabled: false}) as never),
        );
        expect(result.current.limitSeconds).toBe(0);
    });

    it("computes the per-type limit when enabled (cloze = 20s)", () => {
        const {result} = renderHook(() => useTimedLesson(opts() as never));
        expect(result.current.limitSeconds).toBe(20);
        expect(result.current.remainingSeconds).toBe(20);
    });

    it("on timeout records the question wrong and auto-advances", () => {
        const o = opts();
        renderHook(() => useTimedLesson(o as never));

        // Run the full countdown (20s) → onExpire fires forced-wrong.
        act(() => {
            vi.advanceTimersByTime(20_000);
        });
        expect(o.recordStepResult).toHaveBeenCalledWith(
            expect.objectContaining({step_id: "s0", correct: 0, total: 1}),
        );
        expect(o.goNext).not.toHaveBeenCalled();

        // After the 3s "time's up" pause, it auto-advances.
        act(() => {
            vi.advanceTimersByTime(3_000);
        });
        expect(o.goNext).toHaveBeenCalledTimes(1);
    });
});
