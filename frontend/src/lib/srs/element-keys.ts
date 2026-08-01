/**
 * The element_key derivation, as ONE rule (#2303).
 *
 * An SRS row is addressed by ``(user_id, set_id, lesson_id, exercise_id,
 * element_key, direction)``. There is no element id in the content, so the key
 * IS the canonical answer text. Two places need that rule: the runtime
 * derivers in {@link ./element-attempt} (recording an attempt) and the #2128
 * update guard (deciding, before an update is applied, whether a learner's row
 * would still resolve). This module is the rule; both call it.
 *
 * Before #2303 the guard carried its own narrower copy covering five of the
 * thirteen shipped types. For the other eight it returned nothing, so every
 * row on them counted as at-risk and EVERY update — including a harmless one —
 * was reported as breaking. Fail-closed was the right direction and is kept
 * (see {@link elementKeysOf}'s ``null``); the copy was the defect.
 *
 * ## The enumeration is enforced by the compiler, not by discipline
 *
 * A new exercise type that is not handled here must not compile:
 *
 * - core types: ``CORE_ELEMENT_KEY_RULES`` is keyed by the engine's
 *   ``ExerciseType`` union, so a type added to the engine schema breaks the
 *   build until it has a rule;
 * - extension types: ``EXT_ELEMENT_KEY_RULES`` is keyed by
 *   ``ExtensionWizardType``, so adopting an extension without a rule does the
 *   same.
 *
 * @example
 * ```ts
 * elementKeysOf({type: "matching", pairs: [{left: "merci", right: "danke"}]});
 * // -> ["merci"]
 * elementKeysOf({type: "ext:acme-ordering"}); // -> null (unknown, at risk)
 * ```
 */

import type {ExerciseType} from "learn-content-engine";
import {
    CATEGORIZATION_EXT_TYPE,
    DICTATION_EXT_TYPE,
    ERROR_CORRECTION_EXT_TYPE,
    GRADED_QUIZ_EXT_TYPE,
    IMAGE_DESCRIPTION_EXT_TYPE,
    READING_COMPREHENSION_EXT_TYPE,
    isExtensionType,
    type ExtensionWizardType,
} from "../exercises/authoring/extension-edit";
import {asCategorizationPayload} from "../exercises/payload/categorization";
import {asErrorCorrectionPayload} from "../exercises/payload/error-correction";
import {
    asReadingComprehensionPayload,
    canonicalAnswer as rcCanonicalAnswer,
} from "../exercises/payload/reading-comprehension";
import {
    asGradedQuizPayload,
    canonicalAnswer as gradedQuizCanonicalAnswer,
} from "../exercises/payload/graded-quiz";
import {canonicalDictationAnswer} from "../exercises/payload/dictation";
import {canonicalImageDescriptionAnswer} from "../exercises/payload/image-description";
import type {ContentLessonExercise} from "../../storage/types";

/**
 * The exercise fields the key rule reads. Structural on purpose: the #2128
 * peek hands in raw parsed lesson JSON (never a constructed
 * ``ContentLessonExercise``), while the runtime derivers hand in the full
 * type. Both fit without a cast at the call site.
 */
export type KeyBearingExercise = Partial<
    Pick<
        ContentLessonExercise,
        | "type"
        | "pairs"
        | "accept"
        | "tiles"
        | "images"
        | "blanks"
        | "options"
        | "cloze_mode"
        | "ext_payload"
    >
>;

/** The payload readers take the full exercise type but only ever touch
 *  ``ext_payload``; this is the single boundary where the structural peek
 *  shape is presented as one. */
function asFullExercise(exercise: KeyBearingExercise): ContentLessonExercise {
    return exercise as ContentLessonExercise;
}

/**
 * Cloze splits by ``cloze_mode``: ``multiselect`` is one "select all that
 * apply" question with a single key (the sorted correct set), while ``type``
 * and ``select`` fan out one key per authored blank. Getting this wrong is not
 * academic — the pre-#2303 guard applied the blank rule to a multiselect
 * exercise, so its single row never matched and every update looked breaking.
 */
function clozeKeys(exercise: KeyBearingExercise): string[] {
    if (exercise.cloze_mode === "multiselect") {
        return [[...(exercise.accept ?? [])].sort().join(", ")];
    }
    return (exercise.blanks ?? []).map((blank) => blank?.accept?.[0] ?? "");
}

/** One rule per CORE exercise type, keyed by the engine's own union so the
 *  build breaks when the engine adds a type. */
const CORE_ELEMENT_KEY_RULES: Record<
    ExerciseType,
    (exercise: KeyBearingExercise) => string[]
> = {
    matching: (exercise) => (exercise.pairs ?? []).map((pair) => pair?.left ?? ""),
    picture_choice: (exercise) =>
        (exercise.images ?? [])
            .filter((image) => image?.is_correct === "true")
            .map((image) => image?.label ?? ""),
    free_text: (exercise) => [exercise.accept?.[0] ?? ""],
    word_tiles: (exercise) => [(exercise.tiles ?? []).join(" ")],
    cloze: clozeKeys,
    multiple_choice: (exercise) => [
        (exercise.options ?? [])
            .filter((option) => option?.correct === true)
            .map((option) => option?.text ?? "")
            .sort()
            .join(", "),
    ],
};

/** One rule per ADOPTED extension type, keyed by the wizard's own union so the
 *  build breaks when an extension is adopted without a rule. */
const EXT_ELEMENT_KEY_RULES: Record<
    ExtensionWizardType,
    (exercise: KeyBearingExercise) => string[]
> = {
    [CATEGORIZATION_EXT_TYPE]: (exercise) => {
        const payload = asCategorizationPayload(asFullExercise(exercise));
        if (!payload) return [];
        return payload.categories.flatMap((bucket) => bucket.items);
    },
    [ERROR_CORRECTION_EXT_TYPE]: (exercise) => [
        asErrorCorrectionPayload(asFullExercise(exercise))?.accept[0] ?? "",
    ],
    [READING_COMPREHENSION_EXT_TYPE]: (exercise) => {
        const payload = asReadingComprehensionPayload(asFullExercise(exercise));
        if (!payload) return [];
        return payload.questions.map(
            (question) => rcCanonicalAnswer(question) || question.prompt,
        );
    },
    [GRADED_QUIZ_EXT_TYPE]: (exercise) => {
        const payload = asGradedQuizPayload(asFullExercise(exercise));
        if (!payload) return [];
        return payload.questions.map(
            (question) => gradedQuizCanonicalAnswer(question) || question.prompt,
        );
    },
    [DICTATION_EXT_TYPE]: (exercise) => [
        canonicalDictationAnswer(asFullExercise(exercise)),
    ],
    [IMAGE_DESCRIPTION_EXT_TYPE]: (exercise) => [
        canonicalImageDescriptionAnswer(asFullExercise(exercise)),
    ],
};

/**
 * The element_keys ``exercise`` contributes to the SRS, in the order the
 * runtime deriver stamps them.
 *
 * Returns ``null`` when the type is not known here — an undeclared ``ext:``
 * extension, a future core type, or a malformed exercise. ``null`` means "the
 * rule could not be applied", which a caller must treat as at-risk;
 * ``[]`` means "the rule applied and this exercise contributes nothing"
 * (an authored cloze without blanks). Collapsing the two is exactly the bug
 * this module replaced.
 */
export function elementKeysOf(exercise: KeyBearingExercise): string[] | null {
    const type = exercise.type;
    if (typeof type !== "string") return null;
    if (isExtensionType(type)) {
        const extRule = EXT_ELEMENT_KEY_RULES[type as ExtensionWizardType];
        return extRule ? extRule(exercise) : null;
    }
    const coreRule = CORE_ELEMENT_KEY_RULES[type as ExerciseType];
    return coreRule ? coreRule(exercise) : null;
}
