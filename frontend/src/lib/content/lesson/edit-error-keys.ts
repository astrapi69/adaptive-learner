/**
 * App-side binding from the exercise-kit's machine validation codes to the
 * Lesson Creator's i18n keys (#1862).
 *
 * The ``lib/exercises`` authoring validators
 * ({@link validateExerciseEdit} / {@link validateExtensionExercise}) are
 * app-neutral: they report WHICH rule failed as a bare machine code, not an
 * i18n key. This module is the single place that maps a code onto the
 * ``create_lesson.*`` catalog key, so the reusable kit never hardcodes an
 * app-specific i18n namespace.
 *
 * @example
 * ```ts
 * const issue = validateExerciseEdit(draft);
 * if (!issue.valid && issue.code) {
 *   showError(t(exerciseEditErrorKey(issue.code)));
 * }
 * ```
 */

import type {ExerciseEditCode, ExtensionEditCode} from "../../exercises";

/** i18n key for a core-exercise edit failure (``create_lesson.exercises.edit.err_<code>``). */
export function exerciseEditErrorKey(code: ExerciseEditCode): string {
    return `create_lesson.exercises.edit.err_${code}`;
}

/** i18n key for an extension-exercise edit failure (``create_lesson.extensions.edit.err_<code>``). */
export function extensionEditErrorKey(code: ExtensionEditCode): string {
    return `create_lesson.extensions.edit.err_${code}`;
}
