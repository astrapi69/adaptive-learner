/**
 * Tests for useLessonCountdown (#2878): the per-exercise game-mode
 * ring counts down while unanswered, emits ONE wrong-answer
 * celebration on expiry (no auto-submit - the step stays playable),
 * pauses on check, resets on step change, and stays inert while
 * disabled.
 */

import {act, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {useLessonCountdown} from "./useLessonCountdown";
import {subscribeCelebration} from "../../lib/praise/celebration-bus";

interface HookProps {
    enabled: boolean;
    seconds: number;
    stepIndex: number;
    isExerciseStep: boolean;
    checked: boolean;
}

const DEFAULTS: HookProps = {
    enabled: true,
    seconds: 10,
    stepIndex: 0,
    isExerciseStep: true,
    checked: false,
};

const mount = (overrides: Partial<HookProps> = {}) =>
    renderHook((props: HookProps) => useLessonCountdown(props), {
        initialProps: {...DEFAULTS, ...overrides},
    });

let wrongEvents: number;
let unsubscribe: () => void;

beforeEach(() => {
    vi.useFakeTimers();
    wrongEvents = 0;
    unsubscribe = subscribeCelebration((event) => {
        if (event.type === "answer_wrong") wrongEvents += 1;
    });
});

afterEach(() => {
    unsubscribe();
    vi.useRealTimers();
});

describe("useLessonCountdown", () => {
    it("counts down once per second while running", () => {
        const {result} = mount();
        expect(result.current.remaining).toBe(10);
        act(() => vi.advanceTimersByTime(3000));
        expect(result.current.remaining).toBe(7);
        expect(result.current.expired).toBe(false);
    });

    it("emits exactly ONE wrong-answer celebration on expiry and stops", () => {
        const {result} = mount({seconds: 5});
        act(() => vi.advanceTimersByTime(5000));
        expect(result.current.remaining).toBe(0);
        expect(result.current.expired).toBe(true);
        expect(wrongEvents).toBe(1);
        act(() => vi.advanceTimersByTime(5000));
        expect(wrongEvents).toBe(1);
    });

    it("pauses once the step is checked", () => {
        const {result, rerender} = mount();
        act(() => vi.advanceTimersByTime(2000));
        rerender({...DEFAULTS, checked: true});
        act(() => vi.advanceTimersByTime(5000));
        expect(result.current.remaining).toBe(8);
        expect(wrongEvents).toBe(0);
    });

    it("resets on a step change (fresh time, expiry re-armed)", () => {
        const {result, rerender} = mount({seconds: 4});
        act(() => vi.advanceTimersByTime(4000));
        expect(result.current.expired).toBe(true);
        rerender({...DEFAULTS, seconds: 4, stepIndex: 1});
        expect(result.current.remaining).toBe(4);
        expect(result.current.expired).toBe(false);
        act(() => vi.advanceTimersByTime(4000));
        expect(wrongEvents).toBe(2);
    });

    it("stays inert while disabled or on a non-exercise step", () => {
        const {result} = mount({enabled: false, seconds: 3});
        act(() => vi.advanceTimersByTime(5000));
        expect(result.current.remaining).toBe(3);
        expect(wrongEvents).toBe(0);
        const theory = mount({isExerciseStep: false, seconds: 3});
        act(() => vi.advanceTimersByTime(5000));
        expect(theory.result.current.remaining).toBe(3);
        expect(wrongEvents).toBe(0);
    });
});
