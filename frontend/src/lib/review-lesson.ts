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

/** #664 — fingerprint a synthesised step by the QUESTION the learner
 *  actually sees, so two steps that render identically collapse to one.
 *
 *  Element-key dedup (above) is not enough: a REPLAY exercise
 *  (``matching`` / ``picture_choice``) covers several cards, so when N of
 *  those cards are due the queue holds N items with N *distinct*
 *  ``element_key``s that all resolve to the SAME exercise — element-key
 *  dedup keeps all N and the user answers the identical grid N times.
 *
 *  The fingerprint is content-based (type + prompt + the per-type render
 *  payload + direction), so:
 *   - a replayed exercise collapses regardless of which element pulled it
 *     in (identical content → identical signature);
 *   - element-specific clozes stay distinct (different ``sentence`` /
 *     ``blanks`` per blanked token → different signature), which is
 *     correct: those are genuinely different questions. */
function _stepQuestionSignature(step: ContentLessonStep): string {
    const ex = step.exercise;
    if (!ex) return `s:${step.id}`;
    return JSON.stringify([
        ex.type,
        ex.direction ?? "",
        ex.prompt ?? "",
        ex.sentence ?? "",
        ex.blanks ?? null,
        ex.pairs ?? null,
        ex.images ?? null,
        ex.tiles ?? null,
        ex.accept ?? null,
        ex.card_ids ?? null,
    ]);
}

/** #664 — keep at most one step per rendered question. Order-preserving
 *  keep-first: the queue is pre-sorted by priority (overdue → weakness →
 *  error frequency), so the first occurrence of a shared exercise is the
 *  highest-priority (weakest) one — exactly the one to drill. Pure. */
export function dedupeReviewSteps(
    steps: readonly ContentLessonStep[],
): ContentLessonStep[] {
    const seen = new Set<string>();
    const unique: ContentLessonStep[] = [];
    for (const step of steps) {
        const sig = _stepQuestionSignature(step);
        if (seen.has(sig)) continue;
        seen.add(sig);
        unique.push(step);
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
    // #629 BUG 2 — de-dup by element first (one queue item per element_key).
    const byElement = dedupeReviewQueueByElement(queue);
    // Build a step for EVERY element (no cap yet). ``_buildReviewStep``
    // returns null only when the source exercise can't be resolved (lesson
    // evicted from cache) — that item is silently dropped, same as the
    // pre-52G behaviour. Delegating keeps the free_text/word_tiles → cloze
    // logic (Phase 52G) out of this loop.
    const built: ContentLessonStep[] = [];
    for (const item of byElement) {
        const step = _buildReviewStep(
            item,
            cachedLessons.get(item.lesson_id),
        );
        if (step === null) continue;
        built.push(step);
    }
    // #664 — de-dup on the RENDERED QUESTION (after synthesis), so a replay
    // exercise (matching / picture_choice) covering several due cards
    // appears once instead of once-per-card. Element-key dedup alone can't
    // catch this because those cards have distinct element_keys.
    const uniqueSteps = dedupeReviewSteps(built);
    // #664 — cap AFTER question-dedup so the session fills to ``limit``
    // UNIQUE QUESTIONS, not ``limit`` queue items that then collapse to
    // fewer questions (which left the session short).
    const steps = uniqueSteps.slice(0, limit);
    const setId = byElement[0]?.set_id ?? "";
    return {
        id: `review-${setId}-${new Date().toISOString()}`,
        title: opts.title,
        description: opts.description ?? null,
        estimated_minutes: Math.max(1, Math.round(steps.length / 2)),
        cards: [],
        steps,
    };
}
