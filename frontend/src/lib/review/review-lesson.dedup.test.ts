/**
 * #664 — the SAME rendered question must never appear twice in one review
 * session. The #629 ``dedupeReviewQueueByElement`` only dedups by
 * ``element_key``; a REPLAY exercise (matching / picture_choice) covers
 * several cards, so when N of those cards are due the queue holds N items
 * with N distinct ``element_key``s that all point at the SAME exercise.
 * Element-key dedup keeps all N → ``synthesizeReviewLesson`` emits N
 * identical replay steps. This file pins the question-level dedup that
 * fixes it, plus the count/cap consistency that follows.
 */

import {describe, expect, it} from "vitest";

import {
    dedupeReviewSteps,
    synthesizeReviewLesson,
} from "./review-lesson";
import type {
    ContentLesson,
    ContentLessonExercise,
    ContentLessonStep,
    ReviewQueueItem,
} from "../../storage/types";

function matchingExercise(id: string): ContentLessonExercise {
    return {
        id,
        type: "matching",
        prompt: `Match the pairs (${id})`,
        card_ids: ["c-libro", "c-casa", "c-perro"],
        pairs: [
            {left: "libro", right: "book"},
            {left: "casa", right: "house"},
            {left: "perro", right: "dog"},
        ],
        distractors: [],
    };
}

function freeTextExercise(
    id: string,
    cardId: string,
    prompt: string,
): ContentLessonExercise {
    return {
        id,
        type: "free_text",
        prompt,
        card_ids: [cardId],
        accept: [prompt],
        distractors: [],
    };
}

function lessonWith(
    lessonId: string,
    exercises: ContentLessonExercise[],
    cards: ContentLesson["cards"] = [],
): ContentLesson {
    return {
        id: lessonId,
        title: lessonId,
        description: null,
        estimated_minutes: 5,
        cards,
        steps: exercises.map((ex) => ({
            id: `step-${ex.id}`,
            type: "exercise" as const,
            title: null,
            exercise: ex,
        })),
    };
}

function queueItem(
    overrides: Partial<ReviewQueueItem> = {},
): ReviewQueueItem {
    return {
        id: `row-${overrides.element_key ?? "x"}`,
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
        ...overrides,
    };
}

function questionSignatures(steps: readonly ContentLessonStep[]): string[] {
    return steps.map((s) => {
        const ex = s.exercise;
        if (!ex) return `s:${s.id}`;
        return JSON.stringify([
            ex.type,
            ex.prompt ?? "",
            ex.sentence ?? "",
            ex.pairs ?? null,
            ex.blanks ?? null,
            ex.direction ?? "",
        ]);
    });
}

describe("#664 review dedup: same question never appears twice", () => {
    it("collapses a matching exercise that covers 3 due cards to ONE step", () => {
        // Three due cards, all from the same matching exercise → the #629
        // element-key dedup keeps all three (distinct keys) and the OLD
        // synthesizer emitted three identical replay steps.
        const queue = [
            queueItem({element_key: "libro", correct_answer: "book"}),
            queueItem({element_key: "casa", correct_answer: "house"}),
            queueItem({element_key: "perro", correct_answer: "dog"}),
        ];
        const cache = new Map<string, ContentLesson>([
            ["L1", lessonWith("L1", [matchingExercise("ex-match")])],
        ]);
        const out = synthesizeReviewLesson(queue, cache, {title: "Review"});

        const sigs = questionSignatures(out.steps);
        expect(sigs.length).toBe(new Set(sigs).size);
        expect(out.steps).toHaveLength(1);
    });

    it("keeps element-specific clozes distinct (not a duplicate)", () => {
        // Two free_text errors → two DIFFERENT clozes (distinct blanks). These
        // are genuinely different questions and must BOTH survive.
        const cards: ContentLesson["cards"] = [
            {
                id: "c-libro",
                front: "el libro",
                back: "the book",
                token_roles: null,
                tags: [],
            },
            {
                id: "c-casa",
                front: "la casa",
                back: "the house",
                token_roles: null,
                tags: [],
            },
        ];
        const queue = [
            queueItem({
                element_key: "libro",
                exercise_id: "ex-ft-libro",
                correct_answer: "libro",
            }),
            queueItem({
                element_key: "casa",
                exercise_id: "ex-ft-casa",
                correct_answer: "casa",
            }),
        ];
        const cache = new Map<string, ContentLesson>([
            [
                "L1",
                lessonWith(
                    "L1",
                    [
                        freeTextExercise("ex-ft-libro", "c-libro", "el libro"),
                        freeTextExercise("ex-ft-casa", "c-casa", "la casa"),
                    ],
                    cards,
                ),
            ],
        ]);
        const out = synthesizeReviewLesson(queue, cache, {title: "Review"});
        const sigs = questionSignatures(out.steps);
        expect(sigs.length).toBe(new Set(sigs).size);
        expect(out.steps).toHaveLength(2);
    });

    it("dedupeReviewSteps keeps the FIRST (highest-priority) occurrence", () => {
        const ex = matchingExercise("ex-match");
        const steps: ContentLessonStep[] = [
            {id: "review-L1-ex-match-libro", type: "exercise", title: null, exercise: ex},
            {id: "review-L1-ex-match-casa", type: "exercise", title: null, exercise: ex},
        ];
        const unique = dedupeReviewSteps(steps);
        expect(unique).toHaveLength(1);
        expect(unique[0].id).toBe("review-L1-ex-match-libro");
    });

    it("edge: empty queue → empty steps, safe defaults", () => {
        const out = synthesizeReviewLesson([], new Map(), {title: "Review"});
        expect(out.steps).toHaveLength(0);
        expect(dedupeReviewSteps([])).toEqual([]);
    });

    it("edge: a step with no exercise is kept by its id (no crash)", () => {
        const steps: ContentLessonStep[] = [
            {id: "theory-1", type: "theory", title: "Intro", exercise: null},
            {id: "theory-2", type: "theory", title: "More", exercise: null},
        ];
        const unique = dedupeReviewSteps(steps);
        // Distinct ids → both kept; the helper never throws on a null exercise.
        expect(unique).toHaveLength(2);
    });

    it("boundary: special characters + long strings stay distinct", () => {
        const longA = "x".repeat(5000);
        const longB = "y".repeat(5000);
        const mk = (prompt: string, id: string): ContentLessonStep => ({
            id,
            type: "exercise",
            title: null,
            exercise: {
                id,
                type: "free_text",
                prompt,
                card_ids: [],
                accept: [prompt],
                distractors: [],
            },
        });
        const steps = [
            mk(`«café» — naïve ${longA}`, "s1"),
            mk(`«café» — naïve ${longB}`, "s2"),
            mk(`«café» — naïve ${longA}`, "s3"), // identical content to s1
        ];
        const unique = dedupeReviewSteps(steps);
        expect(unique).toHaveLength(2);
        expect(unique[0].id).toBe("s1");
        expect(unique[1].id).toBe("s2");
    });

    it("caps to UNIQUE questions, not raw queue items", () => {
        // 6 due cards → 2 matching exercises (3 cards each) → only 2 unique
        // questions even with a cap of 20.
        const queue = [
            queueItem({element_key: "libro", exercise_id: "ex-m1"}),
            queueItem({element_key: "casa", exercise_id: "ex-m1"}),
            queueItem({element_key: "perro", exercise_id: "ex-m1"}),
            queueItem({element_key: "gato", exercise_id: "ex-m2"}),
            queueItem({element_key: "mesa", exercise_id: "ex-m2"}),
            queueItem({element_key: "silla", exercise_id: "ex-m2"}),
        ];
        const cache = new Map<string, ContentLesson>([
            [
                "L1",
                lessonWith("L1", [
                    matchingExercise("ex-m1"),
                    matchingExercise("ex-m2"),
                ]),
            ],
        ]);
        const out = synthesizeReviewLesson(queue, cache, {
            title: "Review",
            limit: 20,
        });
        expect(out.steps).toHaveLength(2);
    });
});
