/**
 * App-side binding from an exercise ``type`` to the Lesson Creator's i18n
 * label key (#1895).
 *
 * A core {@link GeneratableType} (``matching`` …) is labelled under
 * ``create_lesson.exercises.type.<type>``; an extension type
 * (``ext:al-dictation`` …) under ``create_lesson.extensions.type.<slug>``
 * where the slug strips the ``ext:al-`` namespace. The two label namespaces
 * predate this helper (the core picker + the extension wizard); this is the
 * single place that decides which one applies, so a type surfaced in BOTH
 * pickers (dictation, #1895) never drifts between two label conventions.
 *
 * @example
 * t(exerciseTypeLabelKey("matching"));        // create_lesson.exercises.type.matching
 * t(exerciseTypeLabelKey("ext:al-dictation")); // create_lesson.extensions.type.dictation
 */

import {isExtensionType} from "../../exercises";

/** i18n key for an exercise type's short label (core or extension). */
export function exerciseTypeLabelKey(type: string): string {
    if (isExtensionType(type)) {
        const slug = type.replace("ext:al-", "");
        return `create_lesson.extensions.type.${slug}`;
    }
    return `create_lesson.exercises.type.${type}`;
}
