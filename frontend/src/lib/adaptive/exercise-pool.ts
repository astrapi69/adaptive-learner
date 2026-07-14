/**
 * Exercise pool builder for the adaptive lesson generator
 * (Phase 53B / v1.36.0 / EXP-013 / P-137).
 *
 * Scans every cached lesson for exercises that target the
 * elements the user has been struggling with, then optionally
 * augments the pool with a deterministically-generated cloze
 * (Phase 52E) per error. The lesson generator (53C) picks
 * from this pool with a configurable type-mix.
 *
 * "Targets" = the exercise references at least one card whose
 * ``front`` literally equals the element_key (the vocabulary
 * case) OR whose ``token_roles`` contain a token equal to the
 * element_key (the grammar-token case). The same predicate the
 * cloze generator uses on its first two paths, so the pool's
 * notion of "which exercises test element X" stays consistent
 * with how the review session synthesizer picks alternative
 * exercises in Phase 52G.
 *
 * Deduplication: one candidate per
 * ``(lesson_id, exercise_id, element_key)`` tuple. The same
 * exercise.id appearing in two different lessons would emit
 * two candidates — but the content schema doesn't actually
 * allow this (lesson_id is part of the cache key), so the
 * dedup mostly catches duplicate insertions from the cloze
 * augmentation path.
 *
 * Difficulty estimate (1=easy, 5=hard):
 *   - picture_choice    →  1   (visual recognition; lowest demand)
 *   - matching          →  2   (recognition + pairing)
 *   - cloze (select)    →  2   (recognition + position)
 *   - cloze (type)      →  3   (recall + position; medium)
 *   - free_text         →  4   (full recall)
 *   - word_tiles        →  4   (recall + sequencing)
 *
 * Pure + deterministic. Same inputs → same output, same order.
 */

import {generateClozeFromError} from "../exercises/cloze-generator";
import type {
    ContentLesson,
    ContentLessonCard,
    ContentLessonExercise,
    ElementError,
} from "../../storage/types";

import type {PrioritizedElement} from "./types";

export type DifficultyEstimate = 1 | 2 | 3 | 4 | 5;

export interface ExerciseCandidate {
    exercise: ContentLessonExercise;
    source_set_id: string;
    source_lesson_id: string;
    element_key: string;
    exercise_type: ContentLessonExercise["type"];
    difficulty_estimate: DifficultyEstimate;
    /** ``true`` when the exercise was produced by
     *  ``generateClozeFromError`` (Phase 52E); ``false`` for
     *  authored exercises pulled straight from cached lessons. */
    is_generated: boolean;
}

export interface PoolBuildOpts {
    /** Cached lessons keyed by lesson_id. The builder scans
     *  every entry for exercises matching target elements. The
     *  ``Map`` keying matches what the consumer hook produces
     *  in :meth:`useAdaptiveLesson` (53G). */
    lessons: ReadonlyMap<string, ContentLesson>;
    /** Per-element raw ``ElementError`` row keyed by
     *  ``element_key``. When supplied AND the source exercise
     *  for the element is in ``lessons``, the builder appends
     *  a generated cloze candidate. Omit to suppress
     *  generated candidates (used by unit tests that focus on
     *  the authored-exercise path). */
    errorsByElementKey?: ReadonlyMap<string, ElementError>;
}

/** Difficulty estimate keyed by exercise type. Cloze depends
 *  on ``cloze_mode`` (select=2, type=3 — see module doc). */
function _estimateDifficulty(
    exercise: ContentLessonExercise,
): DifficultyEstimate {
    switch (exercise.type) {
        case "picture_choice":
            return 1;
        case "matching":
            return 2;
        case "cloze":
            return exercise.cloze_mode === "select" ? 2 : 3;
        case "free_text":
            return 4;
        case "word_tiles":
            return 4;
        default:
            return 3;
    }
}

/** Does this exercise + card carry the element_key as its
 *  canonical target? Mirrors the cloze generator's
 *  ``_tryCardTokenRoles`` + ``_tryCardFront`` predicates so the
 *  pool's notion of "tests element X" stays in sync with the
 *  v1.35.0 review-synthesis branch. */
function _cardTargetsElement(
    card: ContentLessonCard,
    elementKey: string,
): boolean {
    if (card.front === elementKey) return true;
    const tokenRoles = card.token_roles ?? [];
    return tokenRoles.some((tr) => tr.token === elementKey);
}

/** Find every authored exercise inside one lesson that targets
 *  ``elementKey`` via a referenced card. Returns candidates in
 *  step order. */
function _candidatesFromLesson(
    lesson: ContentLesson,
    elementKey: string,
): ExerciseCandidate[] {
    const out: ExerciseCandidate[] = [];
    const cardById = new Map(lesson.cards.map((c) => [c.id, c]));
    for (const step of lesson.steps) {
        const exercise = step.exercise;
        if (!exercise) continue;
        // card_ids is optional at runtime (Dexie loads raw content;
        // card-less types like multiple_choice / ext:al-* omit it, #1636).
        // No referenced cards => the exercise can't target via a card.
        const matches = (exercise.card_ids ?? []).some((cid) => {
            const card = cardById.get(cid);
            return card ? _cardTargetsElement(card, elementKey) : false;
        });
        if (!matches) continue;
        out.push({
            exercise,
            source_set_id: _setIdFromLessonId(lesson.id),
            source_lesson_id: lesson.id,
            element_key: elementKey,
            exercise_type: exercise.type,
            difficulty_estimate: _estimateDifficulty(exercise),
            is_generated: false,
        });
    }
    return out;
}

/** Lesson id shape from the content-loader cache is
 *  ``{lesson_filename}`` (e.g. ``"02-numbers.json"``). The
 *  set_id is metadata held by the lesson record but not the
 *  lesson body. The pool builder doesn't really need
 *  ``source_set_id`` for its core algorithm — generator code
 *  uses ``source_lesson_id`` for cross-references — but the
 *  field is plumbed through so downstream callers (Dashboard
 *  "from set X" copy) can show the source set. When the
 *  cached lesson doesn't carry a set_id reference, return
 *  empty and let the caller fill in via metadata. */
function _setIdFromLessonId(_lessonId: string): string {
    return "";
}

/** Try to generate a cloze candidate from an error. Needs the
 *  source exercise (= the one the error was recorded against)
 *  inside the cached lessons. */
function _generatedCandidate(
    error: ElementError,
    lessons: ReadonlyMap<string, ContentLesson>,
): ExerciseCandidate | null {
    const lesson = lessons.get(error.lesson_id);
    if (!lesson) return null;
    let sourceExercise: ContentLessonExercise | null = null;
    for (const step of lesson.steps) {
        if (step.exercise && step.exercise.id === error.exercise_id) {
            sourceExercise = step.exercise;
            break;
        }
    }
    if (!sourceExercise) return null;
    // card_ids is optional at runtime (Dexie raw content; card-less
    // types omit it, #1636). A card-less source exercise yields no
    // source card, so the cloze generator falls back to its literal-front
    // path or returns null.
    const cardIds = sourceExercise.card_ids ?? [];
    // Find the source card (mirrors the review-synth helper).
    let sourceCard: ContentLessonCard | null = null;
    for (const c of lesson.cards) {
        if (cardIds.includes(c.id) && _cardTargetsElement(c, error.element_key)) {
            sourceCard = c;
            break;
        }
    }
    if (!sourceCard && cardIds.length > 0) {
        // Fall back to the first referenced card so the
        // generator's path-2 (literal front match) can still fire.
        sourceCard = lesson.cards.find((c) => c.id === cardIds[0]) ?? null;
    }
    const generated = generateClozeFromError({
        error,
        sourceExercise,
        sourceCard,
    });
    if (!generated) return null;
    return {
        exercise: generated,
        source_set_id: "",
        source_lesson_id: error.lesson_id,
        element_key: error.element_key,
        exercise_type: generated.type,
        difficulty_estimate: _estimateDifficulty(generated),
        is_generated: true,
    };
}

/** Build the exercise pool for the adaptive generator. */
export function buildExercisePool(
    targetElements: readonly PrioritizedElement[],
    opts: PoolBuildOpts,
): ExerciseCandidate[] {
    const lessons = opts.lessons;
    const errors = opts.errorsByElementKey;
    // Stable order: walk targets in priority order, lessons in
    // their lesson_id sort order (alphabetical). Two parallel
    // walks make the output reproducible across runtimes.
    const sortedLessonIds = Array.from(lessons.keys()).sort();
    const seen = new Set<string>();
    const out: ExerciseCandidate[] = [];
    for (const target of targetElements) {
        for (const lessonId of sortedLessonIds) {
            const lesson = lessons.get(lessonId);
            if (!lesson) continue;
            const candidates = _candidatesFromLesson(lesson, target.element_key);
            for (const cand of candidates) {
                const dedupKey = `${cand.source_lesson_id}::${cand.exercise.id}::${cand.element_key}`;
                if (seen.has(dedupKey)) continue;
                seen.add(dedupKey);
                out.push(cand);
            }
        }
        // Optional generated cloze for this element.
        if (errors) {
            const err = errors.get(target.element_key);
            if (err) {
                const gen = _generatedCandidate(err, lessons);
                if (gen) {
                    const dedupKey = `${gen.source_lesson_id}::${gen.exercise.id}::${gen.element_key}`;
                    if (!seen.has(dedupKey)) {
                        seen.add(dedupKey);
                        out.push(gen);
                    }
                }
            }
        }
    }
    return out;
}
