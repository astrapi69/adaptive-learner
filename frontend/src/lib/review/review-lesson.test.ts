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
} from "../../storage/types";

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

// --- #629 BUG 2: no element appears twice in one session -------------------

describe("synthesizeReviewLesson: de-duplication (#629)", () => {
    it("collapses the same element_key from several exercises into one step", () => {
        // Same word ("merci") queued from two different exercises (and,
        // per EXP-018, it could also be queued under two directions). The
        // learner must see it at most once per session.
        const queue = [
            makeQueueItem({
                id: "q1",
                lesson_id: "L1",
                exercise_id: "ex-a",
                element_key: "merci",
                error_count: 5,
            }),
            makeQueueItem({
                id: "q2",
                lesson_id: "L1",
                exercise_id: "ex-b",
                element_key: "merci",
                error_count: 1,
            }),
            makeQueueItem({
                id: "q3",
                lesson_id: "L1",
                exercise_id: "ex-c",
                element_key: "bonjour",
            }),
        ];
        const cache = new Map([
            ["L1", makeLesson("L1", ["ex-a", "ex-b", "ex-c"])],
        ]);
        const out = synthesizeReviewLesson(queue, cache, {title: "Review"});
        const keys = out.steps.map((s) => s.id);
        // "merci" once (the higher-priority ex-a occurrence), "bonjour" once.
        expect(out.steps).toHaveLength(2);
        expect(keys).toContain("review-L1-ex-a-merci");
        expect(keys).not.toContain("review-L1-ex-b-merci");
        expect(keys).toContain("review-L1-ex-c-bonjour");
    });

    it("de-dups BEFORE applying the limit so a session fills up to N unique", () => {
        // 4 duplicates of "dup" followed by 3 unique words. With limit 3,
        // a naive slice-then-build would yield a single unique element;
        // de-dup-first must yield three distinct elements.
        const queue = [
            makeQueueItem({id: "d1", lesson_id: "L1", exercise_id: "ex-0", element_key: "dup"}),
            makeQueueItem({id: "d2", lesson_id: "L1", exercise_id: "ex-1", element_key: "dup"}),
            makeQueueItem({id: "d3", lesson_id: "L1", exercise_id: "ex-2", element_key: "dup"}),
            makeQueueItem({id: "d4", lesson_id: "L1", exercise_id: "ex-3", element_key: "dup"}),
            makeQueueItem({id: "u1", lesson_id: "L1", exercise_id: "ex-4", element_key: "alpha"}),
            makeQueueItem({id: "u2", lesson_id: "L1", exercise_id: "ex-5", element_key: "beta"}),
            makeQueueItem({id: "u3", lesson_id: "L1", exercise_id: "ex-6", element_key: "gamma"}),
        ];
        const cache = new Map([
            [
                "L1",
                makeLesson("L1", [
                    "ex-0",
                    "ex-1",
                    "ex-2",
                    "ex-3",
                    "ex-4",
                    "ex-5",
                    "ex-6",
                ]),
            ],
        ]);
        const out = synthesizeReviewLesson(queue, cache, {
            title: "Review",
            limit: 3,
        });
        const uniqueKeys = new Set(
            out.steps.map((s) => s.exercise?.id ?? ""),
        );
        expect(out.steps).toHaveLength(3);
        expect(uniqueKeys.size).toBe(3);
    });
});

// --- Phase 52G: cloze in review sessions ----------------------------------

function _lessonWithFreeText(
    lessonId: string,
    exerciseId: string,
    accept: string[],
    prompt: string,
): ContentLesson {
    return {
        id: lessonId,
        title: lessonId,
        description: null,
        estimated_minutes: 10,
        cards: [
            {
                id: "card-1",
                front: accept[0],
                back: "translation",
                tags: [],
            },
        ],
        steps: [
            {
                id: `step-${exerciseId}`,
                type: "exercise",
                title: null,
                exercise: {
                    id: exerciseId,
                    type: "free_text",
                    prompt,
                    card_ids: ["card-1"],
                    accept,
                    distractors: ["wrong-1", "wrong-2"],
                },
            },
        ],
    };
}

describe("synthesizeReviewLesson: Phase 52G cloze branch", () => {
    it("generates a cloze step for a free_text source when the front matches element_key", () => {
        const lesson = _lessonWithFreeText(
            "L-ft",
            "ex-ft",
            ["un"],
            "Translate the article",
        );
        const queue: ReviewQueueItem[] = [
            makeQueueItem({
                lesson_id: "L-ft",
                exercise_id: "ex-ft",
                element_key: "un",
                correct_answer: "un",
                user_answer: "le",
            }),
        ];
        const cache = new Map([["L-ft", lesson]]);
        const out = synthesizeReviewLesson(queue, cache, {
            title: "Review",
        });
        expect(out.steps).toHaveLength(1);
        // Cloze step has the gen-cloze-prefixed step id.
        expect(out.steps[0].id.startsWith("review-cloze-L-ft-")).toBe(
            true,
        );
        // Underlying exercise is a cloze.
        expect(out.steps[0].exercise?.type).toBe("cloze");
        expect(out.steps[0].exercise?.sentence).toBeDefined();
    });

    it("falls back to replay when cloze generation returns null", () => {
        // Source card front doesn't contain the element_key, and the
        // prompt doesn't either → generator returns null → replay.
        const lesson = _lessonWithFreeText(
            "L-ft-fail",
            "ex-ft-fail",
            ["bonjour"],
            "Say hi",
        );
        // Force the card front + prompt to not contain element_key.
        lesson.cards[0].front = "no-match";
        const queue: ReviewQueueItem[] = [
            makeQueueItem({
                lesson_id: "L-ft-fail",
                exercise_id: "ex-ft-fail",
                element_key: "bonjour",
                correct_answer: "bonjour",
            }),
        ];
        const cache = new Map([["L-ft-fail", lesson]]);
        const out = synthesizeReviewLesson(queue, cache, {
            title: "Review",
        });
        expect(out.steps).toHaveLength(1);
        // Replay step id has the plain ``review-`` prefix.
        expect(
            out.steps[0].id.startsWith("review-L-ft-fail-"),
        ).toBe(true);
        // Underlying exercise stays free_text (replay, not cloze).
        expect(out.steps[0].exercise?.type).toBe("free_text");
    });

    it("never attempts cloze generation for matching", () => {
        // Default makeLesson uses matching — confirm step is a plain
        // replay with NO cloze id prefix.
        const queue: ReviewQueueItem[] = [
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
        expect(out.steps).toHaveLength(1);
        expect(out.steps[0].exercise?.type).toBe("matching");
        expect(out.steps[0].id.startsWith("review-cloze-")).toBe(
            false,
        );
    });

    it("mixed queue → mixed step shapes (cloze for free_text, replay for matching)", () => {
        const ftLesson = _lessonWithFreeText(
            "L-ft",
            "ex-ft",
            ["un"],
            "Article",
        );
        const queue: ReviewQueueItem[] = [
            makeQueueItem({
                lesson_id: "L-ft",
                exercise_id: "ex-ft",
                element_key: "un",
                correct_answer: "un",
            }),
            makeQueueItem({
                id: "row-2",
                lesson_id: "L1",
                exercise_id: "ex-a",
                element_key: "merci",
            }),
        ];
        const cache = new Map([
            ["L-ft", ftLesson],
            ["L1", makeLesson("L1", ["ex-a"])],
        ]);
        const out = synthesizeReviewLesson(queue, cache, {
            title: "Review",
        });
        expect(out.steps).toHaveLength(2);
        expect(out.steps[0].exercise?.type).toBe("cloze");
        expect(out.steps[1].exercise?.type).toBe("matching");
    });
});

describe("synthesizeReviewLesson: EXP-018 direction carry", () => {
    it("stamps the queue item's direction onto the replayed exercise", () => {
        const cache = new Map([
            ["01-greetings.json", makeLesson("01-greetings.json", ["ex-a"])],
        ]);
        const queue = [
            makeQueueItem({
                exercise_id: "ex-a",
                direction: "source_to_target",
            }),
        ];
        const out = synthesizeReviewLesson(queue, cache, {
            title: "Review",
        });
        expect(out.steps).toHaveLength(1);
        expect(out.steps[0].exercise?.direction).toBe("source_to_target");
    });

    it("defaults a receptive queue item to target_to_source", () => {
        const cache = new Map([
            ["01-greetings.json", makeLesson("01-greetings.json", ["ex-a"])],
        ]);
        const queue = [
            makeQueueItem({
                exercise_id: "ex-a",
                direction: "target_to_source",
            }),
        ];
        const out = synthesizeReviewLesson(queue, cache, {title: "Review"});
        expect(out.steps[0].exercise?.direction).toBe("target_to_source");
    });
});
