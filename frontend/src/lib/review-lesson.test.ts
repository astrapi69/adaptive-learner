/**
 * Tests for synthesizeReviewLesson (Phase 46D / C14 / P-129).
 *
 * Pins:
 * - Top N items pulled, queue order preserved
 * - Each item resolves to its source exercise via
 *   (lesson_id, exercise_id)
 * - Missing source lesson → item silently dropped
 * - Missing exercise inside a present lesson → dropped
 * - Empty queue → empty steps + safe defaults
 * - All steps are type=exercise (no theory)
 * - Synthesised lesson id is stable and human-readable
 */

import {describe, expect, it} from "vitest";

import {
    DEFAULT_REVIEW_LIMIT,
    synthesizeReviewLesson,
} from "./review-lesson";
import type {
    ContentLesson,
    ContentLessonExercise,
    ReviewQueueItem,
} from "../storage/types";

function makeExercise(
    id: string,
    type: ContentLessonExercise["type"] = "matching",
): ContentLessonExercise {
    return {
        id,
        type,
        prompt: `Prompt for ${id}`,
        card_ids: [],
        pairs:
            type === "matching"
                ? [{left: "L", right: "R"}]
                : null,
        distractors: [],
    };
}

function makeLesson(
    lessonId: string,
    exerciseIds: string[],
): ContentLesson {
    return {
        id: lessonId,
        title: lessonId,
        description: null,
        estimated_minutes: 10,
        cards: [],
        steps: exerciseIds.map((eid) => ({
            id: `step-${eid}`,
            type: "exercise" as const,
            title: null,
            exercise: makeExercise(eid),
        })),
    };
}

function makeQueueItem(
    overrides: Partial<ReviewQueueItem> = {},
): ReviewQueueItem {
    return {
        id: "row-1",
        user_id: "user-1",
        set_id: "language-fr-a1",
        lesson_id: "01-greetings.json",
        exercise_id: "ex-a",
        element_key: "merci",
        element_type: "vocabulary",
        user_answer: "",
        correct_answer: "Merci",
        error_count: 1,
        correct_streak: 0,
        last_error_at: null,
        last_attempt_at: "2026-05-27T00:00:00Z",
        suggested_review_at: "2026-05-28T00:00:00Z",
        overdue: false,
        ...overrides,
    };
}

describe("synthesizeReviewLesson: defaults", () => {
    it("DEFAULT_REVIEW_LIMIT is 10", () => {
        expect(DEFAULT_REVIEW_LIMIT).toBe(10);
    });
});

describe("synthesizeReviewLesson: happy path", () => {
    it("produces one exercise step per matched queue item, in queue order", () => {
        const queue = [
            makeQueueItem({
                id: "q1",
                lesson_id: "L1",
                exercise_id: "ex-a",
                element_key: "merci",
            }),
            makeQueueItem({
                id: "q2",
                lesson_id: "L2",
                exercise_id: "ex-b",
                element_key: "bonjour",
            }),
        ];
        const cache = new Map<string, ContentLesson>([
            ["L1", makeLesson("L1", ["ex-a"])],
            ["L2", makeLesson("L2", ["ex-b"])],
        ]);
        const out = synthesizeReviewLesson(queue, cache, {
            title: "Review",
        });
        expect(out.steps).toHaveLength(2);
        expect(out.steps[0].exercise?.id).toBe("ex-a");
        expect(out.steps[1].exercise?.id).toBe("ex-b");
        // All steps must be exercise-type — no theory.
        expect(out.steps.every((s) => s.type === "exercise")).toBe(true);
    });

    it("respects the limit option (default 10)", () => {
        const queue: ReviewQueueItem[] = Array.from(
            {length: 15},
            (_, i) =>
                makeQueueItem({
                    id: `q${i}`,
                    lesson_id: "L1",
                    exercise_id: `ex-${i}`,
                    element_key: `e${i}`,
                }),
        );
        const lesson = makeLesson(
            "L1",
            queue.map((q) => q.exercise_id),
        );
        const cache = new Map([["L1", lesson]]);
        const defaultOut = synthesizeReviewLesson(queue, cache, {
            title: "Review",
        });
        expect(defaultOut.steps).toHaveLength(DEFAULT_REVIEW_LIMIT);

        const customOut = synthesizeReviewLesson(queue, cache, {
            title: "Review",
            limit: 3,
        });
        expect(customOut.steps).toHaveLength(3);
        expect(customOut.steps[0].exercise?.id).toBe("ex-0");
        expect(customOut.steps[2].exercise?.id).toBe("ex-2");
    });

    it("sets title + description from opts", () => {
        const out = synthesizeReviewLesson([], new Map(), {
            title: "My Review",
            description: "Quick refresh",
        });
        expect(out.title).toBe("My Review");
        expect(out.description).toBe("Quick refresh");
    });

    it("synthesised lesson id is stable + namespaced", () => {
        const out = synthesizeReviewLesson(
            [makeQueueItem({set_id: "fr-a1"})],
            new Map([["01-greetings.json", makeLesson("01-greetings.json", ["ex-a"])]]),
            {title: "Review"},
        );
        expect(out.id.startsWith("review-fr-a1-")).toBe(true);
    });

    it("step ids embed the source lesson + exercise + element so they're stable diffable", () => {
        const queue = [
            makeQueueItem({
                lesson_id: "L1",
                exercise_id: "ex-a",
                element_key: "merci",
            }),
        ];
        const cache = new Map([["L1", makeLesson("L1", ["ex-a"])]]);
        const out = synthesizeReviewLesson(queue, cache, {
            title: "Review",
        });
        expect(out.steps[0].id).toBe("review-L1-ex-a-merci");
    });
});

describe("synthesizeReviewLesson: degraded cases", () => {
    it("silently drops items whose source lesson isn't in the cache", () => {
        const queue = [
            makeQueueItem({
                lesson_id: "L1",
                exercise_id: "ex-a",
                element_key: "a",
            }),
            makeQueueItem({
                id: "q2",
                lesson_id: "MISSING",
                exercise_id: "ex-b",
                element_key: "b",
            }),
        ];
        const cache = new Map([["L1", makeLesson("L1", ["ex-a"])]]);
        const out = synthesizeReviewLesson(queue, cache, {
            title: "Review",
        });
        expect(out.steps).toHaveLength(1);
        expect(out.steps[0].exercise?.id).toBe("ex-a");
    });

    it("silently drops items whose exercise_id isn't found inside the lesson", () => {
        const queue = [
            makeQueueItem({
                lesson_id: "L1",
                exercise_id: "ex-MISSING",
            }),
        ];
        const cache = new Map([["L1", makeLesson("L1", ["ex-a"])]]);
        const out = synthesizeReviewLesson(queue, cache, {
            title: "Review",
        });
        expect(out.steps).toEqual([]);
    });

    it("empty queue produces a lesson with no steps", () => {
        const out = synthesizeReviewLesson([], new Map(), {
            title: "Review",
        });
        expect(out.steps).toEqual([]);
        expect(out.cards).toEqual([]);
        expect(out.id.startsWith("review--")).toBe(true);
    });

    it("estimated_minutes >= 1 even for empty step list", () => {
        const out = synthesizeReviewLesson([], new Map(), {
            title: "Review",
        });
        expect(out.estimated_minutes).toBeGreaterThanOrEqual(1);
    });
});
