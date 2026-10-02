/**
 * useShuffleSource (EXP-052 slice 2, refs #3169).
 *
 * The adapter between ``useShuffleLesson`` (called exactly as the page
 * did) and the shell's ``RunnerSource``: status normalisation, the
 * builder's title, the "Mixing {n} questions from {lessons} lessons"
 * subtitle, the per-step ``lesson_id`` from ``review_lesson_id``, the
 * position, the tallies, ``reload`` as a new run, and the lesson count
 * for the summary.
 */

import {act, renderHook} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const useShuffleLessonMock = vi.fn();

vi.mock("../modes/useShuffleLesson", () => ({
    useShuffleLesson: (opts: unknown) => useShuffleLessonMock(opts),
}));

import {useShuffleSource} from "./useShuffleSource";

const step = (id: string, lessonId: string) => ({
    id,
    type: "exercise" as const,
    title: null,
    review_lesson_id: lessonId,
    exercise: {id: `ex-${id}`, type: "cloze" as const, prompt: "p", card_ids: []},
});

const LESSON = {
    id: "shuffle-fr-a1",
    title: "Shuffle: French A1",
    estimated_minutes: 1,
    cards: [{id: "c1"}],
    steps: [step("s0", "01.json"), step("s1", "02.json")],
};

const BASE = {
    status: "ready",
    lesson: LESSON,
    currentStepIndex: 0,
    sourceLessonCount: 2,
    error: null,
    goNext: vi.fn(),
    goPrev: vi.fn(),
    recordStepAttempts: vi.fn().mockResolvedValue(undefined),
    sessionScoreCorrect: 3,
    sessionScoreTotal: 4,
    reload: vi.fn(),
};

beforeEach(() => {
    useShuffleLessonMock.mockReset();
    useShuffleLessonMock.mockReturnValue(BASE);
});

describe("useShuffleSource", () => {
    it("calls useShuffleLesson with the set, the title and the limit, as the page did", () => {
        renderHook(() => useShuffleSource({setId: "fr-a1", limit: 30}));
        expect(useShuffleLessonMock).toHaveBeenCalledWith(
            expect.objectContaining({setId: "fr-a1", title: "Shuffle session", limit: 30}),
        );
    });

    it("happy path: title, subtitle, step, lesson id, position and tallies", () => {
        const {result} = renderHook(() => useShuffleSource({setId: "fr-a1", limit: 20}));
        const source = result.current;
        expect(source.status).toBe("ready");
        expect(source.title).toBe("Shuffle: French A1");
        expect(source.subtitle).toBe("Mixing 2 questions from 2 lessons");
        expect(source.step?.id).toBe("s0");
        expect(source.lessonId).toBe("01.json");
        expect(source.position).toEqual({index: 0, total: 2});
        expect(source.isSummary).toBe(false);
        expect(source.tallies).toEqual({correct: 3, total: 4});
        expect(source.sourceLessonCount).toBe(2);
        expect(source.goPrev).toBe(BASE.goPrev);
    });

    it("boundary: past the last step it is the summary, with no step and no lesson id", () => {
        useShuffleLessonMock.mockReturnValue({...BASE, currentStepIndex: 2});
        const {result} = renderHook(() => useShuffleSource({setId: "fr-a1", limit: 20}));
        expect(result.current.isSummary).toBe(true);
        expect(result.current.step).toBeNull();
        expect(result.current.lessonId).toBe("");
    });

    it.each([
        ["loading", {status: "loading", lesson: null}, "loading"],
        ["empty", {status: "empty", lesson: null}, "empty"],
        ["not cached", {status: "not-cached", lesson: null}, "not-cached"],
        ["ready without a lesson is an error", {status: "ready", lesson: null}, "error"],
    ])("edge: %s", (_name, override, expected) => {
        useShuffleLessonMock.mockReturnValue({...BASE, ...override});
        const {result} = renderHook(() => useShuffleSource({setId: "fr-a1", limit: 20}));
        expect(result.current.status).toBe(expected);
        expect(result.current.step).toBeNull();
    });

    it("reload re-shuffles and starts a new run (the run key moves)", () => {
        const {result} = renderHook(() => useShuffleSource({setId: "fr-a1", limit: 20}));
        const firstKey = result.current.runKey;
        act(() => result.current.reload());
        expect(BASE.reload).toHaveBeenCalledTimes(1);
        expect(result.current.runKey).not.toBe(firstKey);
    });
});
