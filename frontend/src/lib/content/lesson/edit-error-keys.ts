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

import {isExtensionType} from "../../exercises";
import type {ExerciseEditCode, ExtensionEditCode} from "../../exercises";

/** i18n key for a core-exercise edit failure (``create_lesson.exercises.edit.err_<code>``). */
export function exerciseEditErrorKey(code: ExerciseEditCode): string {
    return `create_lesson.exercises.edit.err_${code}`;
}

/**
 * i18n key for an exercise type's short label (#1895). A core
 * {@link GeneratableType} is labelled under
 * ``create_lesson.exercises.type.<type>``; an extension type
 * (``ext:al-dictation`` …) under ``create_lesson.extensions.type.<slug>``
 * where the slug strips the ``ext:al-`` namespace. This is the single place
 * that decides which label namespace applies, so a type surfaced in BOTH the
 * core picker and the extension wizard (dictation) never drifts between two
 * label conventions.
 *
 * @example
 * t(exerciseTypeLabelKey("matching"));         // create_lesson.exercises.type.matching
 * t(exerciseTypeLabelKey("ext:al-dictation")); // create_lesson.extensions.type.dictation
 */
export function exerciseTypeLabelKey(type: string): string {
    if (isExtensionType(type)) {
        const slug = type.replace("ext:al-", "");
        return `create_lesson.extensions.type.${slug}`;
    }
    return `create_lesson.exercises.type.${type}`;
}

/** i18n key for an extension-exercise edit failure (``create_lesson.extensions.edit.err_<code>``). */
export function extensionEditErrorKey(code: ExtensionEditCode): string {
    return `create_lesson.extensions.edit.err_${code}`;
}
