/**
 * #673 — review steps must carry the source ``lesson_id`` explicitly.
 *
 * Root cause of "the N-due badge never drops after a review session": the
 * Review page used to recover the source lesson_id by PARSING the synthesised
 * step id (``review-{lesson_id}-{exercise_id}-{element_key}``), splitting on
 * the last two hyphens. Real exercise ids (``ex-match-begriffe``) and element
 * keys (``Inception-Effekt``, multi-word phrases) contain hyphens/spaces, so
 * the parse mangled the lesson_id. The recorded attempt then landed on a
 * DIFFERENT composite SRS key → a phantom row → the real overdue row was never
 * rescheduled → the badge stayed frozen.
 *
 * The fix: ``synthesizeReviewLesson`` stamps ``review_lesson_id`` on every
 * step, and the Review page reads that instead of parsing. These pins assert
 * the field is present and byte-exact for ids that the old parser mangled.
 */

import {describe, expect, it} from "vitest";

import {
    _buildReviewStep,
    synthesizeReviewLesson,
} from "./review-lesson";
import type {
    ContentLesson,
    ContentLessonExercise,
    ReviewQueueItem,
} from "../../storage/types";

function matchingExercise(id: string): ContentLessonExercise {
    return {
        id,
        type: "matching",
        prompt: `Prompt ${id}`,
        card_ids: ["card-1"],
        pairs: [{left: "Inception-Effekt", right: "definition"}],
        distractors: [],
    };
}

function freeTextExercise(id: string): ContentLessonExercise {
    return {
        id,
        type: "free_text",
        prompt: `Prompt ${id}`,
        card_ids: ["card-1"],
        accept: ["Sokratische Ironie"],
        distractors: [],
    };
}

function lessonWith(
    lessonId: string,
    exercise: ContentLessonExercise,
): ContentLesson {
    return {
        id: lessonId,
        title: lessonId,
        description: null,
        estimated_minutes: 10,
        cards: [
            {
                id: "card-1",
                front: "Inception-Effekt",
                back: "definition",
            } as ContentLesson["cards"][number],
        ],
        steps: [
            {
                id: `step-${exercise.id}`,
                type: "exercise" as const,
                title: null,
                exercise,
            },
        ],
    };
}

function queueItem(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
    return {
        id: "row-1",
        user_id: "user-1",
        set_id: "language-fr-a1",
        // A real filename: dot + hyphen, exactly what the parser mangled.
        lesson_id: "01-greetings.json",
        exercise_id: "ex-match-begriffe",
        element_key: "Inception-Effekt",
        element_type: "vocabulary",
        user_answer: "",
        correct_answer: "definition",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-05-27T00:00:00Z",
        last_attempt_at: "2026-05-27T00:00:00Z",
        suggested_review_at: "2026-05-28T00:00:00Z",
        overdue: true,
        ...overrides,
    };
}

describe("#673 review_lesson_id wiring", () => {
    it("replay step carries the exact source lesson_id (hyphenated ids)", () => {
        const item = queueItem();
        const step = _buildReviewStep(
            item,
            lessonWith(item.lesson_id, matchingExercise(item.exercise_id)),
        );
        expect(step).not.toBeNull();
        expect(step!.review_lesson_id).toBe("01-greetings.json");
    });

    it("cloze step carries the exact source lesson_id", () => {
        const item = queueItem({
            exercise_id: "ex-free-sokratik",
            element_key: "Sokratische Ironie",
            correct_answer: "Sokratische Ironie",
        });
        const step = _buildReviewStep(
            item,
            lessonWith(item.lesson_id, freeTextExercise(item.exercise_id)),
        );
        expect(step).not.toBeNull();
        // free_text → cloze conversion path; lesson_id still exact.
        expect(step!.review_lesson_id).toBe("01-greetings.json");
    });

    it("every synthesised step carries review_lesson_id", () => {
        const queue = [
            queueItem({lesson_id: "L1", exercise_id: "ex-a", element_key: "x"}),
            queueItem({lesson_id: "L2", exercise_id: "ex-b", element_key: "y"}),
        ];
        const cache = new Map<string, ContentLesson>([
            ["L1", lessonWith("L1", matchingExercise("ex-a"))],
            ["L2", lessonWith("L2", matchingExercise("ex-b"))],
        ]);
        const out = synthesizeReviewLesson(queue, cache, {title: "Review"});
        expect(out.steps.length).toBeGreaterThan(0);
        for (const step of out.steps) {
            expect(step.review_lesson_id).toBeTruthy();
        }
    });

    it("regression: the legacy step-id parser WOULD mangle this lesson_id", () => {
        // Documents why review_lesson_id is necessary: reconstruct the old
        // step id and show that last-two-hyphen splitting does not recover
        // "01-greetings.json". The fix bypasses this entirely.
        const item = queueItem();
        const stepId = `review-${item.lesson_id}-${item.exercise_id}-${item.element_key}`;
        const remainder = stepId.slice("review-".length);
        const lastDash = remainder.lastIndexOf("-");
        const secondLastDash = remainder.lastIndexOf("-", lastDash - 1);
        const parsed = remainder.slice(0, secondLastDash);
        expect(parsed).not.toBe("01-greetings.json");
    });
});
