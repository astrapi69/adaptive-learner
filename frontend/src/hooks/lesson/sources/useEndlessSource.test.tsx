/**
 * useEndlessSource (EXP-052 slice 2, refs #3169).
 *
 * The first source without a position: the adapter owns the stream's own
 * step counter (a repeated card with the same id must still count as a
 * new step), the active-seconds timer that freezes while paused, the
 * toggle pause and the End that leads to the summary. No goPrev: a stream
 * has no previous step.
 */

import {act, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const useEndlessLessonMock = vi.fn();

vi.mock("../modes/useEndlessLesson", () => ({
    useEndlessLesson: (opts: unknown) => useEndlessLessonMock(opts),
}));

import {useEndlessSource} from "./useEndlessSource";

const STEP = {
    id: "endless-01.json-ex-a",
    type: "exercise" as const,
    title: null,
    review_lesson_id: "01.json",
    exercise: {id: "ex-a", type: "cloze" as const, prompt: "p", card_ids: []},
};

const STATS = {cards: 3, correct: 2, reviewsDone: 1, newLearned: 1, errorsPracticed: 1, xp: 2};

const BASE = {
    status: "ready",
    step: STEP,
    cards: [],
    stats: STATS,
    error: null,
    advance: vi.fn(),
    recordStepAttempts: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
    vi.useFakeTimers();
    useEndlessLessonMock.mockReset();
    useEndlessLessonMock.mockReturnValue(BASE);
    BASE.advance.mockClear();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("useEndlessSource: the stream shape", () => {
    it("happy path: no position, no goPrev, the step's lesson id, stats in the tallies", () => {
        const {result} = renderHook(() => useEndlessSource({setId: "fr-a1"}));
        const source = result.current;
        expect(useEndlessLessonMock).toHaveBeenCalledWith(
            expect.objectContaining({setId: "fr-a1", title: "Endless practice"}),
        );
        expect(source.position).toBeNull();
        expect(source.goPrev).toBeUndefined();
        expect(source.title).toBe("Endless practice");
        expect(source.lessonId).toBe("01.json");
        expect(source.tallies).toEqual({correct: 2, total: 3, stats: STATS, elapsedSec: 0});
        expect(source.isSummary).toBe(false);
    });

    it("reproduction: the step counter moves on every goNext, even when the card repeats", () => {
        const {result} = renderHook(() => useEndlessSource({setId: "fr-a1"}));
        expect(result.current.streamStep).toBe(0);
        act(() => result.current.goNext());
        act(() => result.current.goNext());
        expect(BASE.advance).toHaveBeenCalledTimes(2);
        expect(result.current.streamStep).toBe(2);
        expect(result.current.step?.id).toBe(STEP.id);
    });
});

describe("useEndlessSource: timer, pause and end", () => {
    it("counts active seconds while playing", () => {
        const {result} = renderHook(() => useEndlessSource({setId: "fr-a1"}));
        act(() => vi.advanceTimersByTime(3000));
        expect(result.current.tallies.elapsedSec).toBe(3);
    });

    it("edge: the pause freezes the timer and the toggle resumes it", () => {
        const {result} = renderHook(() => useEndlessSource({setId: "fr-a1"}));
        act(() => vi.advanceTimersByTime(2000));
        act(() => result.current.pause?.onToggle());
        expect(result.current.pause?.paused).toBe(true);
        act(() => vi.advanceTimersByTime(5000));
        expect(result.current.tallies.elapsedSec).toBe(2);
        act(() => result.current.pause?.onToggle());
        act(() => vi.advanceTimersByTime(1000));
        expect(result.current.pause?.paused).toBe(false);
        expect(result.current.tallies.elapsedSec).toBe(3);
    });

    it("End leads to the summary, stops the clock and drops the step", () => {
        const {result} = renderHook(() => useEndlessSource({setId: "fr-a1"}));
        act(() => vi.advanceTimersByTime(4000));
        act(() => result.current.pause?.onEnd());
        expect(result.current.isSummary).toBe(true);
        expect(result.current.step).toBeNull();
        act(() => vi.advanceTimersByTime(4000));
        expect(result.current.tallies.elapsedSec).toBe(4);
    });

    it("boundary: ending while paused ends unpaused (the summary is not a paused run)", () => {
        const {result} = renderHook(() => useEndlessSource({setId: "fr-a1"}));
        act(() => result.current.pause?.onToggle());
        act(() => result.current.pause?.onEnd());
        expect(result.current.isSummary).toBe(true);
        expect(result.current.pause?.paused).toBe(false);
    });

    it.each([
        ["loading", "loading"],
        ["empty", "empty"],
        ["not-cached", "not-cached"],
        ["error", "error"],
    ])("edge: status %s passes through, the clock does not run", (status, expected) => {
        useEndlessLessonMock.mockReturnValue({...BASE, status, step: null});
        const {result} = renderHook(() => useEndlessSource({setId: "fr-a1"}));
        act(() => vi.advanceTimersByTime(3000));
        expect(result.current.status).toBe(expected);
        expect(result.current.tallies.elapsedSec).toBe(0);
        expect(result.current.isSummary).toBe(false);
    });
});
