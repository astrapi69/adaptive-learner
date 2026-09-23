/**
 * #3170 - every synthesised review step names the queue elements it
 * covers (``review_element_keys``), and the #664 question-dedup MERGES
 * the keys of a collapsed duplicate into the surviving step. The session
 * counts elements covered, not steps rendered, so "8 von 10" (steps of
 * elements) and "10 von 10" (attempts) become ONE number.
 */

import {describe, expect, it} from "vitest";

import {
    countCoveredElements,
    coveredElementKeys,
    dedupeReviewSteps,
    synthesizeReviewLesson,
} from "./review-lesson";
import type {
    ContentLesson,
    ContentLessonExercise,
    ContentLessonStep,
    ReviewQueueItem,
} from "../../storage/types";

function matching(id: string, prompt = "Match"): ContentLessonExercise {
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
        set_id: "es-a1",
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

describe("review_element_keys (#3170)", () => {
    it("repro: 3 due cards of one matching exercise -> ONE step covering 3 elements", () => {
        const queue = [
            qItem({element_key: "libro"}),
            qItem({element_key: "casa"}),
            qItem({element_key: "perro"}),
        ];
        const out = synthesizeReviewLesson(
            queue,
            new Map([["L1", lessonWith([matching("ex-match")])]]),
            {title: "Review"},
        );
        expect(out.steps).toHaveLength(1);
        expect(out.steps[0].review_element_keys).toEqual(["libro", "casa", "perro"]);
        expect(countCoveredElements(out.steps)).toBe(3);
    });

    it("happy path: distinct exercises -> one key per step", () => {
        const queue = [
            qItem({element_key: "a", exercise_id: "ex-1"}),
            qItem({element_key: "b", exercise_id: "ex-2"}),
        ];
        const out = synthesizeReviewLesson(
            queue,
            new Map([["L1", lessonWith([matching("ex-1", "Q1"), matching("ex-2", "Q2")])]]),
            {title: "Review"},
        );
        expect(out.steps.map((s) => s.review_element_keys)).toEqual([["a"], ["b"]]);
        expect(coveredElementKeys(out.steps)).toEqual(["a", "b"]);
    });

    it("dedupeReviewSteps merges the dropped duplicate's keys into the kept step", () => {
        const ex = matching("ex-match");
        const steps: ContentLessonStep[] = [
            {id: "s-libro", type: "exercise", title: null, exercise: ex, review_element_keys: ["libro"]},
            {id: "s-casa", type: "exercise", title: null, exercise: ex, review_element_keys: ["casa"]},
        ];
        const unique = dedupeReviewSteps(steps);
        expect(unique).toHaveLength(1);
        expect(unique[0].id).toBe("s-libro");
        expect(unique[0].review_element_keys).toEqual(["libro", "casa"]);
        // Pure: the input step is not mutated.
        expect(steps[0].review_element_keys).toEqual(["libro"]);
    });

    it("edge: a step without keys (legacy / mocked) counts as one element", () => {
        const steps: ContentLessonStep[] = [
            {id: "s1", type: "exercise", title: null, exercise: matching("ex-1", "Q1")},
            {id: "s2", type: "exercise", title: null, exercise: matching("ex-2", "Q2"), review_element_keys: ["x", "y"]},
        ];
        expect(countCoveredElements(steps)).toBe(3);
        expect(countCoveredElements([])).toBe(0);
    });

    it("boundary: the cap applies to steps, the covered count can exceed it", () => {
        // 4 elements, two per matching exercise, cap 1 -> 1 step, 2 elements.
        const queue = [
            qItem({element_key: "libro", exercise_id: "ex-1"}),
            qItem({element_key: "casa", exercise_id: "ex-1"}),
            qItem({element_key: "a", exercise_id: "ex-2"}),
            qItem({element_key: "b", exercise_id: "ex-2"}),
        ];
        const out = synthesizeReviewLesson(
            queue,
            new Map([["L1", lessonWith([matching("ex-1", "Q1"), matching("ex-2", "Q2")])]]),
            {title: "Review", limit: 1},
        );
        expect(out.steps).toHaveLength(1);
        expect(countCoveredElements(out.steps)).toBe(2);
    });
});
