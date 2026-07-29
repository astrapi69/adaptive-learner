/**
 * CHARACTERIZATION TEST — documents the silent progress/SRS orphaning that
 * happens today when an already-imported set is UPDATED to a new version
 * whose identity strings changed (#2128, data-loss).
 *
 * These assertions pin the CURRENT (lossy) behaviour on purpose — they are a
 * regression pin for a known data-integrity risk, not a spec of desired
 * behaviour. When cross-repo ID stability lands (the ID-stability strategy,
 * see #2125's sibling exploration), the orphaning goes away and these
 * assertions flip; that flip is the signal the fix worked.
 *
 * Why it lives at this layer: a set update replaces CONTENT only and never
 * touches LessonProgress / ElementError (proven both-mode in #2128). The loss
 * surfaces later, in the mode-agnostic frontend read/synthesis layer, when the
 * retained rows no longer resolve against the changed content. So the loss
 * mechanism is exercised here through the REAL exported functions
 * (synthesizeReviewLesson + the availability oracle), not derived.
 *
 * Identity facts that make this bite (Ist-Aufnahme):
 *  - exercise_id is POSITIONAL for AI/analysis/book content (ex-match-{i},
 *    ai-ex-{n}, vocab-{i}) — an insert/reorder shifts it.
 *  - element_key is the ANSWER CONTENT itself (accept[0], pair.left, card
 *    front) — a typo fix in the answer changes it.
 *  - LessonProgress keys on the lesson FILENAME — a rename orphans it.
 */

import {describe, expect, it} from "vitest";

import {
    buildContentAvailability,
    filterAvailableProgress,
} from "./content-availability";
import {
    dedupeReviewQueueByElement,
    synthesizeReviewLesson,
} from "../../review/review-lesson";
import type {
    ContentLesson,
    ContentLessonExercise,
    ReviewQueueItem,
} from "../../../storage/types";

function exercise(
    id: string,
    type: ContentLessonExercise["type"] = "matching",
): ContentLessonExercise {
    return {
        id,
        type,
        prompt: `Prompt for ${id}`,
        card_ids: [],
        pairs: type === "matching" ? [{left: "L", right: "R"}] : null,
        distractors: [],
    };
}

function lesson(lessonId: string, exerciseIds: string[]): ContentLesson {
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
            exercise: exercise(eid),
        })),
    };
}

function qItem(over: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
    return {
        id: "row-1",
        user_id: "user-1",
        set_id: "language-fr-a1",
        lesson_id: "01-greetings.json",
        exercise_id: "ex-match-1",
        element_key: "merci",
        element_type: "vocabulary",
        user_answer: "",
        correct_answer: "Merci",
        error_count: 4,
        correct_streak: 0,
        last_error_at: null,
        last_attempt_at: "2026-05-27T00:00:00Z",
        suggested_review_at: "2026-05-28T00:00:00Z",
        overdue: true,
        ...over,
    };
}

/** Minimal shape the availability oracle reads from a progress row. */
function progressRow(over: {
    source: string;
    set_id: string;
    lesson_filename: string;
}) {
    return {...over};
}

describe("set update silently orphans progress/SRS (#2128, characterization)", () => {
    it("positional exercise_id shift (insert/reorder) drops the review AND leaves a phantom due-count", () => {
        // A learner has an overdue SRS card on the 2nd matching exercise of a
        // generated lesson: exercise_id "ex-match-1" (0-based positional).
        const queue = [qItem({exercise_id: "ex-match-1", element_key: "gestern"})];

        // The author inserts an exercise and bumps the set version. On the next
        // (silent 24h) auto-sync the content is overwritten: the element the
        // learner erred on is now the 3rd exercise → "ex-match-2". The old
        // "ex-match-1" slot now holds a DIFFERENT element.
        const updatedCache = new Map<string, ContentLesson>([
            ["01-greetings.json", lesson("01-greetings.json", ["ex-match-0", "ex-match-2"])],
        ]);

        const review = synthesizeReviewLesson(queue, updatedCache, {title: "Review"});

        // The scheduled review is SILENTLY DROPPED — the recorded error can no
        // longer be resolved against the changed content.
        expect(review.steps).toHaveLength(0);

        // ...yet the queue still counts it: the "cards due" badge lies (a
        // phantom overdue element the learner can never actually review).
        expect(dedupeReviewQueueByElement(queue)).toHaveLength(1);
    });

    it("element_key (answer text) typo fix is swallowed silently — no drop, no signal", () => {
        // The learner's SRS row records element_key "recieve" (the answer they
        // kept getting wrong). The author fixes the typo in the card/answer;
        // element_key is the answer CONTENT, so it is now "receive".
        const staleQueue = [
            qItem({exercise_id: "ex-match-1", element_key: "recieve"}),
        ];
        // Exercise id unchanged, so the exercise still resolves.
        const updatedCache = new Map<string, ContentLesson>([
            ["01-greetings.json", lesson("01-greetings.json", ["ex-match-1"])],
        ]);

        const review = synthesizeReviewLesson(staleQueue, updatedCache, {title: "Review"});

        // The step is still built (exercise_id matched); the element_key
        // mismatch produces NO drop and NO warning — the system cannot tell the
        // reviewed content changed under the recorded error, so the learner
        // reviews the current content as if nothing moved.
        expect(review.steps).toHaveLength(1);
    });

    it("renamed lesson file orphans LessonProgress but the availability oracle keeps it (dead 'Continue' link)", () => {
        // Progress recorded against the old filename.
        const progress = [
            progressRow({
                source: "owner/repo",
                set_id: "language-fr-a1",
                lesson_filename: "01-intro.json",
            }),
        ];

        // The update renames the lesson file (01-intro.json -> 01-greetings.json)
        // but the SET is still present and cached.
        const updatedSets = [
            {source: "owner/repo", id: "language-fr-a1", cached_version: "2.0.0"},
        ];
        const availability = buildContentAvailability(updatedSets);

        // The oracle keys on (source, set_id) only — it CANNOT see that the
        // lesson file was renamed, so the orphaned-filename row survives the
        // filter and becomes a dead "Continue" link that 404s on click.
        expect(availability.isProgressAvailable("owner/repo", "language-fr-a1")).toBe(true);
        expect(filterAvailableProgress(progress, availability)).toHaveLength(1);
    });
});
