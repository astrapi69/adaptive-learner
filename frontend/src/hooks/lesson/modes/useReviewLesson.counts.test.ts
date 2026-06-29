/**
 * #664 — count + dedup consistency for the SRS review hook.
 *
 * Pins, through the real pipeline (reviewQueue → dedup → synthesize):
 *   - ``dueCount`` = unique elements due (deduped by element_key, uncapped).
 *   - ``lesson.steps.length`` (presented) = unique QUESTIONS after the
 *     matching/picture_choice collapse and the cap.
 *   - the header source (presented) can never exceed ``dueCount``.
 *   - a matching exercise covering several due cards yields ONE step.
 *   - unresolvable elements drop out (steps < dueCount), so the header
 *     and the progress bar agree.
 *
 * Storage is mocked so the same assertions hold for BOTH storage modes —
 * the hook routes everything through ``getStorage()`` and the synthesizer
 * is pure, so the API path and the Dexie path share this exact code.
 */

import {renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const reviewQueueMock = vi.fn();
const listSetsMock = vi.fn();
const getLessonMock = vi.fn();

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            reviewQueue: reviewQueueMock,
            recordBulk: vi.fn().mockResolvedValue([]),
        },
        contentLoader: {listSets: listSetsMock, getLesson: getLessonMock},
    }),
}));

import {useReviewLesson} from "./useReviewLesson";
import type {
    ContentLesson,
    ContentLessonExercise,
    ReviewQueueItem,
} from "../../../storage/types";

const SET_ID = "es-a1";

function matching(id: string): ContentLessonExercise {
    return {
        id,
        type: "matching",
        prompt: `Match (${id})`,
        card_ids: ["c-libro", "c-casa", "c-perro"],
        pairs: [
            {left: "libro", right: "book"},
            {left: "casa", right: "house"},
            {left: "perro", right: "dog"},
        ],
        distractors: [],
    };
}

function lessonWith(
    lessonId: string,
    exercises: ContentLessonExercise[],
): ContentLesson {
    return {
        id: lessonId,
        title: lessonId,
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

beforeEach(() => {
    reviewQueueMock.mockReset();
    listSetsMock.mockReset();
    getLessonMock.mockReset();
    listSetsMock.mockResolvedValue({
        sets: [{id: SET_ID, source: "bundled:es"}],
    });
});

describe("#664 useReviewLesson: count + dedup consistency", () => {
    it("repro: a matching exercise over 3 due cards → ONE step, dueCount 3", async () => {
        reviewQueueMock.mockResolvedValue([
            qItem({element_key: "libro", correct_answer: "book"}),
            qItem({element_key: "casa", correct_answer: "house"}),
            qItem({element_key: "perro", correct_answer: "dog"}),
        ]);
        getLessonMock.mockResolvedValue(lessonWith("L1", [matching("ex-match")]));

        const {result} = renderHook(() =>
            useReviewLesson({setId: SET_ID, title: "Review", limit: 20}),
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));

        // Three due ELEMENTS, but only ONE rendered QUESTION.
        expect(result.current.dueCount).toBe(3);
        expect(result.current.lesson?.steps).toHaveLength(1);
        // The header source can never exceed dueCount.
        expect(result.current.lesson!.steps.length).toBeLessThanOrEqual(
            result.current.dueCount,
        );
    });

    it("happy path: 3 distinct exercises → 3 steps, dueCount 3, no cap", async () => {
        reviewQueueMock.mockResolvedValue([
            qItem({element_key: "a", exercise_id: "ex-1"}),
            qItem({element_key: "b", exercise_id: "ex-2"}),
            qItem({element_key: "c", exercise_id: "ex-3"}),
        ]);
        getLessonMock.mockResolvedValue(
            lessonWith("L1", [
                {...matching("ex-1"), prompt: "Q1"},
                {...matching("ex-2"), prompt: "Q2"},
                {...matching("ex-3"), prompt: "Q3"},
            ]),
        );
        const {result} = renderHook(() =>
            useReviewLesson({setId: SET_ID, title: "Review", limit: 20}),
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(result.current.dueCount).toBe(3);
        expect(result.current.lesson?.steps).toHaveLength(3);
    });

    it("inconsistency 1: unresolvable elements drop → steps < dueCount", async () => {
        reviewQueueMock.mockResolvedValue([
            qItem({element_key: "a", exercise_id: "ex-present", lesson_id: "L1"}),
            qItem({element_key: "b", exercise_id: "ex-missing", lesson_id: "L1"}),
            qItem({element_key: "c", exercise_id: "ex-gone", lesson_id: "L2"}),
        ]);
        // L1 only has ex-present; ex-missing isn't in it. L2 fetch throws.
        getLessonMock.mockImplementation(
            async (_src: string, _set: string, lessonId: string) => {
                if (lessonId === "L2") throw new Error("evicted");
                return lessonWith("L1", [{...matching("ex-present"), prompt: "P"}]);
            },
        );
        const {result} = renderHook(() =>
            useReviewLesson({setId: SET_ID, title: "Review", limit: 20}),
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        // 3 unique elements due, but only 1 has a resolvable question.
        expect(result.current.dueCount).toBe(3);
        expect(result.current.lesson?.steps).toHaveLength(1);
    });

    it("edge case: empty queue → status empty, dueCount 0, no lesson", async () => {
        reviewQueueMock.mockResolvedValue([]);
        const {result} = renderHook(() =>
            useReviewLesson({setId: SET_ID, title: "Review", limit: 20}),
        );
        await waitFor(() => expect(result.current.status).toBe("empty"));
        expect(result.current.dueCount).toBe(0);
        expect(result.current.lesson).toBeNull();
    });

    it("boundary: 50 distinct due elements, limit 20 → 20 steps, dueCount 50", async () => {
        const queue = Array.from({length: 50}, (_, i) =>
            qItem({element_key: `e${i}`, exercise_id: `ex-${i}`}),
        );
        const lesson = lessonWith(
            "L1",
            queue.map((q) => ({...matching(q.exercise_id), prompt: `Q${q.exercise_id}`})),
        );
        getLessonMock.mockResolvedValue(lesson);
        reviewQueueMock.mockResolvedValue(queue);

        const {result} = renderHook(() =>
            useReviewLesson({setId: SET_ID, title: "Review", limit: 20}),
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(result.current.dueCount).toBe(50);
        expect(result.current.lesson?.steps).toHaveLength(20);
    });

    it("boundary: per-direction rows of one card are one element → one step", async () => {
        // Same element_key, both EXP-018 directions → element-key dedup keeps
        // one; the matching exercise renders once.
        reviewQueueMock.mockResolvedValue([
            qItem({element_key: "libro", direction: "target_to_source"}),
            qItem({element_key: "libro", direction: "source_to_target"}),
        ]);
        getLessonMock.mockResolvedValue(lessonWith("L1", [matching("ex-match")]));
        const {result} = renderHook(() =>
            useReviewLesson({setId: SET_ID, title: "Review", limit: 20}),
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(result.current.dueCount).toBe(1);
        expect(result.current.lesson?.steps).toHaveLength(1);
    });
});
