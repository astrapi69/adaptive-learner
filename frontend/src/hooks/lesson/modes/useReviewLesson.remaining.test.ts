/**
 * #3170 - the session's counters follow the elements ACTUALLY played.
 *
 * Before: ``remaining = dueCount - steps.length``. Two due cards of one
 * matching exercise collapse into the surviving step (#664), the step's
 * recording advances them, and the summary still said "Noch 2 fällig.
 * Weitermachen?" - and "Weitere Runde" re-fetched the same queue, round
 * after round. Now the hook tracks the element keys played in this
 * session (recorded attempts + the keys a completed step covers), derives
 * ``remaining`` from what was NOT played, tallies the summary per element,
 * and a further round only presents the unplayed rest, until nothing is
 * left ("empty").
 *
 * Storage is mocked, so the pins hold for both storage modes (the hook is
 * the shared path).
 */

import {act, renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const reviewQueueMock = vi.fn();
const listSetsMock = vi.fn();
const getLessonMock = vi.fn();
const recordBulkMock = vi.fn().mockResolvedValue([]);

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {reviewQueue: reviewQueueMock, recordBulk: recordBulkMock},
        contentLoader: {listSets: listSetsMock, getLesson: getLessonMock},
    }),
}));

import {useReviewLesson} from "./useReviewLesson";
import type {
    ContentLesson,
    ContentLessonExercise,
    ElementAttempt,
    ReviewQueueItem,
} from "../../../storage/types";

const SET_ID = "es-a1";

function matching(id: string, prompt = `Match (${id})`): ContentLessonExercise {
    return {
        id,
        type: "matching",
        prompt,
        card_ids: ["c-libro", "c-casa", "c-perro"],
        pairs: [
            {left: "libro", right: "book"},
            {left: "casa", right: "house"},
            {left: "perro", right: "dog"},
        ],
        distractors: [],
    };
}

function lessonWith(exercises: ContentLessonExercise[]): ContentLesson {
    return {
        id: "L1",
        title: "L1",
        description: null,
        estimated_minutes: 5,
        cards: [],
        steps: exercises.map((ex) => ({
            id: `step-${ex.id}`,
            type: "exercise" as const,
            title: null,
            exercise: ex,
        })),
    };
}

function qItem(over: Partial<ReviewQueueItem>): ReviewQueueItem {
    return {
        id: `row-${over.element_key ?? "x"}`,
        user_id: "user-1",
        set_id: SET_ID,
        lesson_id: "L1",
        exercise_id: "ex-match",
        element_key: "libro",
        direction: "target_to_source",
        element_type: "vocabulary",
        user_answer: "",
        correct_answer: "book",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-05-27T00:00:00Z",
        last_attempt_at: "2026-05-27T00:00:00Z",
        suggested_review_at: "2026-05-28T00:00:00Z",
        overdue: true,
        ...over,
    };
}

function attempt(elementKey: string, correct: boolean, exerciseId = "ex-match"): ElementAttempt {
    return {
        set_id: SET_ID,
        lesson_id: "L1",
        exercise_id: exerciseId,
        element_key: elementKey,
        correct,
    };
}

beforeEach(() => {
    reviewQueueMock.mockReset();
    listSetsMock.mockReset();
    getLessonMock.mockReset();
    recordBulkMock.mockClear();
    listSetsMock.mockResolvedValue({sets: [{id: SET_ID, source: "bundled:es"}]});
});

describe("#3170 useReviewLesson: remaining follows the played elements", () => {
    it("repro: 3 cards collapse to 1 matching step; its recording plays all 3 -> remaining 0", async () => {
        reviewQueueMock.mockResolvedValue([
            qItem({element_key: "libro"}),
            qItem({element_key: "casa"}),
            qItem({element_key: "perro"}),
        ]);
        getLessonMock.mockResolvedValue(lessonWith([matching("ex-match")]));
        const {result} = renderHook(() =>
            useReviewLesson({setId: SET_ID, title: "Review", limit: 20}),
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(result.current.dueCount).toBe(3);
        expect(result.current.lesson?.steps).toHaveLength(1);
        // Nothing played yet: everything is still remaining.
        expect(result.current.remaining).toBe(3);

        await act(async () => {
            await result.current.recordStepAttempts(
                [attempt("libro", true), attempt("casa", true), attempt("perro", false)],
                result.current.lesson!.steps[0],
            );
        });
        expect(result.current.remaining).toBe(0);
        // Element-based tally, same basis as the subtitle.
        expect(result.current.sessionScoreTotal).toBe(3);
        expect(result.current.sessionScoreCorrect).toBe(2);
    });

    it("happy path: a capped round leaves the unplayed rest; the next round presents only that rest, then ends", async () => {
        const queue = [
            qItem({element_key: "a", exercise_id: "ex-1"}),
            qItem({element_key: "b", exercise_id: "ex-2"}),
            qItem({element_key: "c", exercise_id: "ex-3"}),
        ];
        reviewQueueMock.mockResolvedValue(queue);
        getLessonMock.mockResolvedValue(
            lessonWith([matching("ex-1"), matching("ex-2"), matching("ex-3")]),
        );
        const {result} = renderHook(() =>
            useReviewLesson({setId: SET_ID, title: "Review", limit: 2}),
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(result.current.dueCount).toBe(3);
        expect(result.current.lesson?.steps).toHaveLength(2);

        await act(async () => {
            await result.current.recordStepAttempts([attempt("a", true, "ex-1")]);
            await result.current.recordStepAttempts([attempt("b", false, "ex-2")]);
        });
        expect(result.current.remaining).toBe(1);

        // Another round: the storage still returns all three rows (the
        // played ones are rescheduled, not gone), but only "c" is pending.
        act(() => result.current.reload());
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(result.current.dueCount).toBe(1);
        expect(result.current.lesson?.steps).toHaveLength(1);
        expect(result.current.lesson?.steps[0].review_element_keys).toEqual(["c"]);
        // The per-round tally starts fresh.
        expect(result.current.sessionScoreTotal).toBe(0);

        await act(async () => {
            await result.current.recordStepAttempts([attempt("c", true, "ex-3")]);
        });
        expect(result.current.remaining).toBe(0);

        // A third round has nothing left to present: no loop.
        act(() => result.current.reload());
        await waitFor(() => expect(result.current.status).toBe("empty"));
        expect(result.current.dueCount).toBe(0);
    });

    it("edge: a completed step counts its collapsed keys as played even when the recorder omits them", async () => {
        reviewQueueMock.mockResolvedValue([
            qItem({element_key: "libro"}),
            qItem({element_key: "casa"}),
        ]);
        getLessonMock.mockResolvedValue(lessonWith([matching("ex-match")]));
        const {result} = renderHook(() =>
            useReviewLesson({setId: SET_ID, title: "Review", limit: 20}),
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        await act(async () => {
            // The recorder only reports "libro"; the step still covered "casa".
            await result.current.recordStepAttempts(
                [attempt("libro", true)],
                result.current.lesson!.steps[0],
            );
        });
        expect(result.current.remaining).toBe(0);
    });

    it("boundary: two attempts on one element tally as ONE element (last outcome wins)", async () => {
        reviewQueueMock.mockResolvedValue([]);
        const {result} = renderHook(() =>
            useReviewLesson({setId: SET_ID, title: "Review", limit: 20}),
        );
        await waitFor(() => expect(result.current.status).toBe("empty"));
        await act(async () => {
            await result.current.recordStepAttempts([attempt("merci", false)]);
            await result.current.recordStepAttempts([attempt("merci", true)]);
        });
        expect(result.current.sessionScoreTotal).toBe(1);
        expect(result.current.sessionScoreCorrect).toBe(1);
    });
});
