/**
 * Pure flash-round rules (#2888) - the per-set special round of the
 * game mode: finishing a set (every lesson completed with at least
 * one star) unlocks a generated round built from the set's most
 * error-prone elements. Both rules are pure so the unlock gate and
 * the selection are unit-testable against real row shapes (the
 * cross-layer pinning rule in lessons/content-storage.md).
 */

import {computeStars} from "../lesson/lesson-summary";
import type {
    ContentLesson,
    ContentLessonCard,
    ContentLessonExercise,
    ElementError,
    LessonProgress,
} from "../../storage/types";

/** Whether the set's flash round is unlocked: EVERY lesson filename
 *  has a completed progress row scoring at least one star. An empty
 *  lesson list never unlocks (nothing was finished). */
export function isFlashRoundUnlocked(
    lessons: readonly string[],
    progress: readonly LessonProgress[],
    setId: string,
): boolean {
    if (lessons.length === 0) return false;
    const bySetLesson = new Map<string, LessonProgress>();
    for (const row of progress) {
        if (row.set_id === setId) bySetLesson.set(row.lesson_filename, row);
    }
    return lessons.every((filename) => {
        const row = bySetLesson.get(filename);
        if (!row || row.status !== "completed") return false;
        return computeStars(row.score_correct, row.score_total) >= 1;
    });
}

/** The most error-prone elements of the set, deterministically ranked:
 *  error count desc, then attempt count desc, then element key asc -
 *  the ``buildSetReview`` weak-area ordering with fixed tie-breaks -
 *  capped at ``count``. */
export function selectFlashRoundErrors(
    errors: readonly ElementError[],
    count: number,
): ElementError[] {
    return [...errors]
        .sort(
            (a, b) =>
                b.error_count - a.error_count ||
                (b.attempt_count ?? 0) - (a.attempt_count ?? 0) ||
                a.element_key.localeCompare(b.element_key),
        )
        .slice(0, Math.max(0, count));
}

export interface FlashRoundContent {
    exercises: ContentLessonExercise[];
    cards: ContentLessonCard[];
}

/** Resolve the selected errors to playable content: each error's
 *  exercise looked up in its source lesson (deduped by exercise id,
 *  unresolvable references skipped - an evicted lesson or a renamed
 *  exercise must never crash the round), plus the cards of every
 *  contributing lesson (deduped by id) for the error-replay player. */
export function collectFlashRoundExercises(
    errors: readonly ElementError[],
    lessonsByFilename: ReadonlyMap<string, ContentLesson>,
): FlashRoundContent {
    const exercises: ContentLessonExercise[] = [];
    const seenExercises = new Set<string>();
    const cards = new Map<string, ContentLessonCard>();
    for (const error of errors) {
        if (seenExercises.has(error.exercise_id)) continue;
        const lesson = lessonsByFilename.get(error.lesson_id);
        if (!lesson) continue;
        const step = lesson.steps.find(
            (s) =>
                s.type === "exercise" &&
                s.exercise?.id === error.exercise_id,
        );
        if (!step?.exercise) continue;
        seenExercises.add(error.exercise_id);
        exercises.push(step.exercise);
        for (const card of lesson.cards) {
            if (!cards.has(card.id)) cards.set(card.id, card);
        }
    }
    return {exercises, cards: [...cards.values()]};
}
