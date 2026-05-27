/**
 * synthesizeReviewLesson (Phase 46D / C14 / P-129).
 *
 * Builds an in-memory ``ContentLesson`` from an SRS review
 * queue + the cached lesson payloads the elements came
 * from. The Lesson viewer (Phase 44) renders the result
 * the same way it renders a real cached lesson — no
 * special-case rendering needed.
 *
 * Per Phase 46 D3: review = replay the original exercises.
 * No new exercise types, no AI generation, no cloze. v1
 * keeps it simple. Variation + generation earns its own
 * phase later.
 *
 * Selection:
 * - Queue is already sorted (overdue → error_count desc →
 *   last_error_at desc); we just take the top ``limit``
 *   items (default 10) without re-sorting.
 * - For each item, look up the exercise via
 *   ``(lesson_id, exercise_id)`` in the cached lesson
 *   bundle. An item whose source exercise is missing
 *   (e.g. lesson was evicted from the cache after the
 *   element was recorded) is silently dropped — better
 *   than crashing the review.
 *
 * Synthesised lesson shape:
 * - ``id``: ``"review-{setId}-{ISO timestamp}"`` so each
 *   synthesised review is uniquely identifiable in
 *   anchors / progress logs.
 * - ``title``: i18n caller decides; default localised in
 *   the consumer.
 * - ``cards``: empty (cards are display-only metadata for
 *   real lessons; reviews use the underlying exercises).
 * - ``steps``: one exercise step per selected element,
 *   preserving queue order. No theory steps.
 */

import type {
    ContentLesson,
    ContentLessonExercise,
    ContentLessonStep,
    ReviewQueueItem,
} from "../storage/types";

export const DEFAULT_REVIEW_LIMIT = 10;

export interface SynthesizeOpts {
    /** Cap on the number of elements pulled from the queue.
     *  Default 10. Cap stays small so the review session
     *  stays under ~5 minutes. */
    limit?: number;
    /** Title for the synthesised lesson. Callers pass an
     *  already-localised string (this module is i18n-naive). */
    title: string;
    /** Optional description shown under the title. */
    description?: string | null;
}

/** Look up an exercise by ``exercise_id`` inside a cached
 *  lesson payload. Returns null when the exercise can't be
 *  resolved (lesson evicted, content updated, etc.). */
function _findExercise(
    lesson: ContentLesson | undefined,
    exerciseId: string,
): ContentLessonExercise | null {
    if (!lesson) return null;
    for (const step of lesson.steps) {
        if (step.exercise && step.exercise.id === exerciseId) {
            return step.exercise;
        }
    }
    return null;
}

/** Synthesise a review-mode ``ContentLesson`` from the
 *  prioritised queue + the cached lesson bundle.
 *
 *  ``cachedLessons`` is a map keyed by ``lesson_id`` (the
 *  same id the queue items reference). Caller is
 *  responsible for fetching the cached lessons before
 *  invoking this function — that's an async I/O step that
 *  belongs in the hook layer (C15), not in this pure
 *  utility. */
export function synthesizeReviewLesson(
    queue: readonly ReviewQueueItem[],
    cachedLessons: ReadonlyMap<string, ContentLesson>,
    opts: SynthesizeOpts,
): ContentLesson {
    const limit = opts.limit ?? DEFAULT_REVIEW_LIMIT;
    const top = queue.slice(0, limit);
    const steps: ContentLessonStep[] = [];
    for (const item of top) {
        const exercise = _findExercise(
            cachedLessons.get(item.lesson_id),
            item.exercise_id,
        );
        if (exercise === null) continue;
        steps.push({
            // Stable step id derived from the source lesson +
            // exercise + element so two review sessions over
            // the same elements produce diffable step lists.
            id: `review-${item.lesson_id}-${item.exercise_id}-${item.element_key}`,
            type: "exercise",
            title: null,
            exercise,
        });
    }
    const setId = top[0]?.set_id ?? "";
    return {
        id: `review-${setId}-${new Date().toISOString()}`,
        title: opts.title,
        description: opts.description ?? null,
        estimated_minutes: Math.max(1, Math.round(steps.length / 2)),
        cards: [],
        steps,
    };
}
