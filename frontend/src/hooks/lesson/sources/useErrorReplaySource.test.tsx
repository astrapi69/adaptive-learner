/**
 * useErrorReplaySource (EXP-052 slice 3, refs #3169).
 *
 * The Error Replay's router-state origin as a ``RunnerSource``, and the
 * round logic that used to live inline in the page, tested on its own for
 * the first time: the round plays only the failed exercises; a graded
 * answer counts as fully correct when ``correct === total``; "try again"
 * narrows the round to the still-wrong exercises in a new SECTION of the
 * same run (the lock drops, hint usage stays); a flash round retitles the
 * run and leaves to its origin; the attempts merge into the SRS error list
 * through ``recordBulk`` (#1304), failure-tolerant.
 */

import {act, renderHook} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import type {ContentLessonExercise, ElementAttempt} from "../../../storage/types";

const hoisted = vi.hoisted(() => ({
    recordBulk: vi.fn(),
    notify: vi.fn(),
    userId: {value: "user-1" as string | null},
}));

vi.mock("../../../storage", () => ({
    getStorage: () => ({elementErrors: {recordBulk: hoisted.recordBulk}}),
}));

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: hoisted.userId.value, projectId: null, language: "en"}),
}));

vi.mock("../../../lib/review/reviewsChanged", () => ({
    notifyReviewsChanged: () => hoisted.notify(),
}));

import {useErrorReplaySource, type ReplayState} from "./useErrorReplaySource";

const FREE = (id: string): ContentLessonExercise => ({
    id,
    type: "free_text",
    prompt: `Translate ${id}`,
    card_ids: [],
    accept: ["x"],
    distractors: [],
});

const STATE: ReplayState = {
    exercises: [FREE("ex-a"), FREE("ex-b")],
    cards: [],
    lessonTitle: "Greetings",
};

const PARAMS = {setSlug: "slug", setId: "fr-a1", filename: "03.json"};

const ATTEMPT: ElementAttempt = {
    set_id: "fr-a1",
    lesson_id: "03.json",
    exercise_id: "ex-a",
    element_key: "hola",
    correct: true,
};

function mount(state: ReplayState | null = STATE) {
    return renderHook(() => useErrorReplaySource({state, ...PARAMS}));
}

const graded = (correct: number, total = 1) => ({correct, total, attempts: []});

beforeEach(() => {
    hoisted.recordBulk.mockReset();
    hoisted.recordBulk.mockResolvedValue([]);
    hoisted.notify.mockReset();
    hoisted.userId.value = "user-1";
});

describe("useErrorReplaySource: the round", () => {
    it("happy path: plays the failed exercises as exercise steps, titled after the lesson", () => {
        const {result} = mount();
        const source = result.current;
        expect(source.status).toBe("ready");
        expect(source.title).toBe("Retry errors: Greetings");
        expect(source.wrapTitle).toBe(true);
        expect(source.step).toMatchObject({id: "ex-a", type: "exercise", exercise: {id: "ex-a"}});
        expect(source.position).toEqual({index: 0, total: 2});
        expect(source.lessonId).toBe("03.json");
        expect(source.setId).toBe("fr-a1");
        expect(source.runKey).toBe("fr-a1/03.json");
        expect(source.backTo).toBe("/lesson/slug/fr-a1/03.json");
        expect(source.flashRound).toBeNull();
        expect(source.isSummary).toBe(false);
    });

    it.each([
        ["no router state (direct navigation, a refresh lost it)", null],
        ["router state without exercises (a clean run)", {...STATE, exercises: []}],
    ])("edge: %s is the empty screen", (_name, state) => {
        const {result} = mount(state);
        expect(result.current.status).toBe("empty");
        expect(result.current.step).toBeNull();
    });

    it("a graded answer counts as fully correct only when correct === total", () => {
        const {result} = mount();
        act(() => result.current.onStepScored?.("ex-a", graded(2, 2)));
        act(() => result.current.goNext());
        act(() => result.current.onStepScored?.("ex-b", graded(1, 2)));
        act(() => result.current.goNext());
        expect(result.current.isSummary).toBe(true);
        expect(result.current.step).toBeNull();
        expect(result.current.tallies).toEqual({correct: 1, total: 2});
        expect(result.current.stillWrong).toBe(1);
    });

    it("boundary: all correct leaves nothing still wrong", () => {
        const {result} = mount();
        act(() => result.current.onStepScored?.("ex-a", graded(1)));
        act(() => result.current.goNext());
        act(() => result.current.onStepScored?.("ex-b", graded(1)));
        act(() => result.current.goNext());
        expect(result.current.stillWrong).toBe(0);
        expect(result.current.tallies).toEqual({correct: 2, total: 2});
    });

    it("reproduction: try again narrows to the still-wrong exercises in a new section of the same run", () => {
        const {result} = mount();
        act(() => result.current.onStepScored?.("ex-a", graded(1)));
        act(() => result.current.goNext());
        act(() => result.current.onStepScored?.("ex-b", graded(0)));
        act(() => result.current.goNext());
        const {runKey, sectionKey} = result.current;
        act(() => result.current.retryStillWrong());
        expect(result.current.step?.id).toBe("ex-b");
        expect(result.current.position).toEqual({index: 0, total: 1});
        expect(result.current.tallies).toEqual({correct: 0, total: 1});
        expect(result.current.isSummary).toBe(false);
        expect(result.current.runKey).toBe(runKey);
        expect(result.current.sectionKey).not.toBe(sectionKey);
    });

    it("boundary: Previous stops at the first step, Next at the summary", () => {
        const {result} = mount();
        act(() => result.current.goPrev?.());
        expect(result.current.position).toEqual({index: 0, total: 2});
        act(() => result.current.goNext());
        act(() => result.current.goNext());
        act(() => result.current.goNext());
        expect(result.current.position).toEqual({index: 2, total: 2});
        expect(result.current.isSummary).toBe(true);
    });

    it("stepAnswered follows the graded steps of the section (the countdown pauses on them)", () => {
        const {result} = mount();
        expect(result.current.stepAnswered).toBe(false);
        act(() => result.current.onStepScored?.("ex-a", graded(1)));
        expect(result.current.stepAnswered).toBe(true);
        act(() => result.current.goNext());
        expect(result.current.stepAnswered).toBe(false);
        act(() => result.current.goPrev?.());
        expect(result.current.stepAnswered).toBe(true);
    });
});

describe("useErrorReplaySource: flash round (#2888)", () => {
    const FLASH: ReplayState = {
        ...STATE,
        lessonTitle: "French A1",
        flashRound: {seconds: 20, backTo: "/content/set/fr-a1"},
    };

    it("titles the run as a flash round and leaves to the round's origin", () => {
        const {result} = renderHook(() =>
            useErrorReplaySource({state: FLASH, ...PARAMS, filename: "flash-round"}),
        );
        expect(result.current.title).toBe("Flash round: French A1");
        expect(result.current.backTo).toBe("/content/set/fr-a1");
        expect(result.current.flashRound).toEqual({seconds: 20, backTo: "/content/set/fr-a1"});
    });
});

describe("useErrorReplaySource: SRS merge (#1304)", () => {
    it("happy path: records the attempts for the learner and announces the change", async () => {
        const {result} = mount();
        await act(() => result.current.recordStepAttempts([ATTEMPT]));
        expect(hoisted.recordBulk).toHaveBeenCalledWith("user-1", [ATTEMPT]);
        expect(hoisted.notify).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["no attempts", [], "user-1"],
        ["no learner id", [ATTEMPT], null],
    ])("edge: %s records nothing", async (_name, attempts, userId) => {
        hoisted.userId.value = userId;
        const {result} = mount();
        await act(() => result.current.recordStepAttempts(attempts as ElementAttempt[]));
        expect(hoisted.recordBulk).not.toHaveBeenCalled();
    });

    it("a failed write never blocks the round", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        hoisted.recordBulk.mockRejectedValue(new Error("boom"));
        const {result} = mount();
        await act(() => result.current.recordStepAttempts([ATTEMPT]));
        expect(warn).toHaveBeenCalled();
        expect(hoisted.notify).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});
