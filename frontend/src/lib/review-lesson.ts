/**
 * synthesizeReviewLesson (Phase 46D / C14 / P-129; Phase 52G upgrade).
 *
 * Builds an in-memory ``ContentLesson`` from an SRS review
 * queue + the cached lesson payloads the elements came
 * from. The Lesson viewer (Phase 44) renders the result
 * the same way it renders a real cached lesson — no
 * special-case rendering needed.
 *
 * Phase 46 D3 originally specced "review = replay the original
 * exercises, no new types, no AI". Phase 52G partially relaxes
 * that: per source exercise type:
 *
 *   - ``free_text`` or ``word_tiles`` → try to generate a Cloze
 *     via ``generateClozeFromError``. On success, emit the cloze
 *     step (shape-change: tests the same knowledge but in a
 *     different form, exercising the user's flexibility). On
 *     generator failure (returns null), fall through to replay
 *     so the review never serves a broken step.
 *   - ``matching`` or ``picture_choice`` → always replay original.
 *     Generating a cloze from a recognition exercise would
 *     change the cognitive demand; replay is the right call.
 *   - ``cloze`` (Phase 52D content) → always replay original.
 *     Re-generating cloze from cloze adds no signal.
 *
 * The cloze generator is deterministic + offline; no AI call.
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

import {generateClozeFromError} from "./exercises/cloze-generator";
import type {
    ContentLesson,
    ContentLessonCard,
    ContentLessonExercise,
    ContentLessonStep,
    ElementError,
    ReviewQueueItem,
} from "../storage/types";

export const DEFAULT_REVIEW_LIMIT = 10;

/** #629 BUG 2 — keep at most one queue item per ``element_key`` so the
 *  same word never appears twice in one review session. The queue is
 *  pre-sorted by priority (overdue → weakness → frequency), so the first
 *  occurrence is the most urgent direction/exercise; later duplicates
 *  (a second exercise drilling the same word, or the other EXP-018
 *  direction) are dropped. Pure + order-preserving. */
export function dedupeReviewQueueByElement<T extends {element_key: string}>(
    queue: readonly T[],
): T[] {
    const seen = new Set<string>();
    const unique: T[] = [];
    for (const item of queue) {
        if (seen.has(item.element_key)) continue;
        seen.add(item.element_key);
        unique.push(item);
    }
    return unique;
}

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

/** Find the source card for an SRS review item. Prefers an exact
 *  front-string match against ``element_key`` (the canonical the
 *  generator targets) and falls back to substring then to the
 *  first card the source exercise references. Returns null when
 *  the source exercise has no card_ids. */
function _findSourceCard(
    lesson: ContentLesson | undefined,
    exercise: ContentLessonExercise,
    elementKey: string,
): ContentLessonCard | null {
    if (!lesson) return null;
    const exact = lesson.cards.find(
        (c) =>
            exercise.card_ids.includes(c.id) && c.front === elementKey,
    );
    if (exact) return exact;
    const substr = lesson.cards.find(
        (c) =>
            exercise.card_ids.includes(c.id) &&
            c.front.includes(elementKey),
    );
    if (substr) return substr;
    const firstRef = lesson.cards.find((c) =>
        exercise.card_ids.includes(c.id),
    );
    return firstRef ?? null;
}

/** Adapter: ReviewQueueItem already carries every SRS field the
 *  cloze generator needs, but the generator's API is typed on
 *  ``ElementError`` (the persisted shape) so this wraps the queue
 *  item with the missing mastered/created/updated fields. Pure
 *  shape transform — no IO. */
function _itemToError(item: ReviewQueueItem): ElementError {
    return {
        id: item.id,
        user_id: item.user_id,
        set_id: item.set_id,
        lesson_id: item.lesson_id,
        exercise_id: item.exercise_id,
        element_key: item.element_key,
        direction: item.direction,
        element_type: item.element_type,
        user_answer: item.user_answer,
        correct_answer: item.correct_answer,
        error_count: item.error_count,
        correct_streak: item.correct_streak,
        last_error_at: item.last_error_at,
        last_attempt_at: item.last_attempt_at,
        mastered: false,
        mastered_at: null,
        created_at: item.last_attempt_at,
        updated_at: item.last_attempt_at,
    };
}

/** Per-item branch (Phase 52G / Decision 5):
 *  - free_text or word_tiles → try generating a cloze
 *  - else (or generator returns null) → replay original
 *  Returns null only when the source exercise itself cannot be
 *  located in the cached lesson (the existing C14 semantics
 *  for "lesson evicted from cache"). */
export function _buildReviewStep(
    item: ReviewQueueItem,
    sourceLesson: ContentLesson | undefined,
): ContentLessonStep | null {
    const exercise = _findExercise(sourceLesson, item.exercise_id);
    if (exercise === null) return null;

    // EXP-018 / Phase 62: the review drills the SAME direction the
    // error was recorded under (a productive error reviews
    // productively), so the per-direction SRS loop stays coherent.
    const dir: "source_to_target" | "target_to_source" =
        item.direction === "source_to_target"
            ? "source_to_target"
            : "target_to_source";

    if (exercise.type === "free_text" || exercise.type === "word_tiles") {
        const sourceCard = _findSourceCard(
            sourceLesson,
            exercise,
            item.element_key,
        );
        const generated = generateClozeFromError({
            error: _itemToError(item),
            sourceExercise: exercise,
            sourceCard,
        });
        if (generated !== null) {
            return {
                id: `review-cloze-${item.lesson_id}-${item.exercise_id}-${item.element_key}`,
                type: "exercise",
                title: null,
                exercise: {...generated, direction: dir},
            };
        }
        // Fall through to replay on generator failure.
    }

    return {
        id: `review-${item.lesson_id}-${item.exercise_id}-${item.element_key}`,
        type: "exercise",
        title: null,
        exercise: {...exercise, direction: dir},
    };
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
    // #629 BUG 2 — de-dup by element BEFORE slicing so a session fills up
    // to ``limit`` UNIQUE elements (a naive slice-then-build could spend
    // the whole cap on repeats of one word).
    const top = dedupeReviewQueueByElement(queue).slice(0, limit);
    const steps: ContentLessonStep[] = [];
    for (const item of top) {
        // Per-item branch is delegated to ``_buildReviewStep`` so the
        // free_text/word_tiles → cloze logic (Phase 52G) stays out
        // of the queue-walking loop. Returns null only when the
        // source exercise can't be resolved (lesson evicted from
        // cache); that case is silently dropped — same as the
        // pre-52G behaviour.
        const step = _buildReviewStep(
            item,
            cachedLessons.get(item.lesson_id),
        );
        if (step === null) continue;
        steps.push(step);
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
