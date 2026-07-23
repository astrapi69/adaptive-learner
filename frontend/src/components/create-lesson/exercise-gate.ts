/**
 * Advance-gate helpers for the Lesson Creator's exercise steps, extracted from
 * CreateLesson so the page module stays under the cohesion size gate (#1970).
 * Pure functions — no React, no app state.
 */

import {
    isExtensionType,
    validateExerciseEdit,
    validateExtensionExercise,
} from "../../lib/exercises";
import {MIN_EXERCISES} from "./ExerciseGenerator";
import type {ContentLessonExercise} from "../../storage/types";

/** True iff any exercise (core or extension) is still incomplete — the
 *  half-filled-exercise guard shared by every advance gate. */
export function hasIncompleteExercise(
    exercises: ContentLessonExercise[],
): boolean {
    return exercises.some((ex) =>
        isExtensionType(ex.type)
            ? !validateExtensionExercise(ex).valid
            : !validateExerciseEdit(ex).valid,
    );
}

/** #1970 — the exercise count below which "Next" is blocked. Editing an
 *  existing, previously-valid lesson relaxes the create-time ``MIN_EXERCISES``
 *  to 1: the book generator legitimately produces < 5 exercises (types it
 *  cannot render are skipped), so such a lesson must stay editable + saveable.
 *  Creating a new lesson keeps the full minimum. */
export function minExercisesToAdvance(editMode: boolean): number {
    return editMode ? 1 : MIN_EXERCISES;
}
