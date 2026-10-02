/**
 * useAdaptiveSource (EXP-052 slice 3, refs #3169).
 *
 * The adapter between ``useAdaptiveLesson`` (called exactly as the page
 * did) and the shell's ``RunnerSource``: status normalisation, the
 * generated lesson's title, the position, the tallies with the mastery
 * delta (F-116), the transparency block and the lesson for the header
 * extension and the save button, and the one-time ``finalize`` when the
 * learner first lands on the summary (moved out of the page).
 */

import {renderHook} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const useAdaptiveLessonMock = vi.fn();

vi.mock("../modes/useAdaptiveLesson", () => ({
    useAdaptiveLesson: (opts: unknown) => useAdaptiveLessonMock(opts),
}));

import {useAdaptiveSource} from "./useAdaptiveSource";

const step = (id: string) => ({
    id,
    type: "exercise" as const,
    title: null,
    body: null,
    exercise: {id: `ex-${id}`, type: "cloze" as const, prompt: "p", card_ids: []},
});

const LESSON = {
    id: "adaptive",
    title: "Adaptive lesson",
    estimated_minutes: 5,
    cards: [{id: "c1"}],
    steps: [step("adaptive-step-0-a-ex"), step("adaptive-step-1-b-ex")],
};

const TRANSPARENCY = {tags: [], total_errors: 3, active_elements: 2, mastered_before: 1};

const finalize = vi.fn().mockResolvedValue(undefined);

const BASE = {
    status: "ready",
    lesson: LESSON,
    transparency: TRANSPARENCY,
    currentStepIndex: 0,
    error: null,
    goNext: vi.fn(),
    goPrev: vi.fn(),
    recordStepAttempts: vi.fn().mockResolvedValue(undefined),
    sessionScoreCorrect: 2,
    sessionScoreTotal: 3,
    masteredDelta: null,
    finalize,
};

beforeEach(() => {
    useAdaptiveLessonMock.mockReset();
    useAdaptiveLessonMock.mockReturnValue(BASE);
    finalize.mockClear();
});

describe("useAdaptiveSource", () => {
    it("calls useAdaptiveLesson with the set, the lesson scope and the title, as the page did", () => {
        renderHook(() => useAdaptiveSource({setId: "fr-a1", lessonId: "03.json"}));
        expect(useAdaptiveLessonMock).toHaveBeenCalledWith(
            expect.objectContaining({setId: "fr-a1", lessonId: "03.json", title: "Adaptive lesson"}),
        );
    });

    it("happy path: title, step, position, tallies, transparency and the lesson", () => {
        const {result} = renderHook(() => useAdaptiveSource({setId: "fr-a1"}));
        const source = result.current;
        expect(source.status).toBe("ready");
        expect(source.title).toBe("Adaptive lesson");
        expect(source.step?.id).toBe("adaptive-step-0-a-ex");
        expect(source.lessonId).toBe("");
        expect(source.position).toEqual({index: 0, total: 2});
        expect(source.isSummary).toBe(false);
        expect(source.tallies).toEqual({correct: 2, total: 3, masteredDelta: null});
        expect(source.transparency).toBe(TRANSPARENCY);
        expect(source.lesson).toBe(LESSON);
        expect(source.goPrev).toBe(BASE.goPrev);
        expect(source.cards).toBe(LESSON.cards);
    });

    it("the run key narrows to the lesson scope (#1012)", () => {
        const set = renderHook(() => useAdaptiveSource({setId: "fr-a1"}));
        const scoped = renderHook(() => useAdaptiveSource({setId: "fr-a1", lessonId: "03.json"}));
        expect(set.result.current.runKey).not.toBe(scoped.result.current.runKey);
    });

    it.each([
        ["loading", {status: "loading", lesson: null}, "loading"],
        ["empty", {status: "empty", lesson: null}, "empty"],
        ["not cached", {status: "not-cached", lesson: null}, "not-cached"],
        ["error", {status: "error", lesson: null, error: "boom"}, "error"],
        ["ready without a lesson is an error", {status: "ready", lesson: null}, "error"],
    ])("edge: %s", (_name, override, expected) => {
        useAdaptiveLessonMock.mockReturnValue({...BASE, ...override});
        const {result} = renderHook(() => useAdaptiveSource({setId: "fr-a1"}));
        expect(result.current.status).toBe(expected);
        expect(result.current.step).toBeNull();
    });

    it("boundary: past the last step it is the summary, carrying the mastery delta", () => {
        useAdaptiveLessonMock.mockReturnValue({...BASE, currentStepIndex: 2, masteredDelta: 2});
        const {result} = renderHook(() => useAdaptiveSource({setId: "fr-a1"}));
        expect(result.current.isSummary).toBe(true);
        expect(result.current.step).toBeNull();
        expect(result.current.tallies.masteredDelta).toBe(2);
    });

    it("finalizes once, the first time the summary is reached (F-116)", () => {
        const {rerender} = renderHook(() => useAdaptiveSource({setId: "fr-a1"}));
        expect(finalize).not.toHaveBeenCalled();
        useAdaptiveLessonMock.mockReturnValue({...BASE, currentStepIndex: 2});
        rerender();
        rerender();
        expect(finalize).toHaveBeenCalledTimes(1);
        useAdaptiveLessonMock.mockReturnValue({...BASE, currentStepIndex: 1});
        rerender();
        useAdaptiveLessonMock.mockReturnValue({...BASE, currentStepIndex: 2});
        rerender();
        expect(finalize).toHaveBeenCalledTimes(1);
    });
});
