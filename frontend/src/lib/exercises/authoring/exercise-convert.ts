/**
 * Exercise type conversion — Stage 1 (EXP-050, #2511).
 *
 * Lets an author change an existing exercise's ``type`` in place without
 * losing the written content. The flat ``extra="forbid"`` content schema
 * (``schema_generated.py``) carries every type's fields on ONE ``Exercise``
 * object, distinguished by ``type``; converting therefore means: change
 * ``type``, add the target's fields, and DROP the source's fields (a
 * left-over ``tiles`` on a now-``free_text`` exercise would be rejected on
 * load).
 *
 * Stage 1 ships only the KEY-PRESERVING ``-> free_text`` conversions whose
 * single canonical answer carries 1:1 into ``accept[0]``, so the SRS/error
 * history (addressed by ``(exercise_id, element_key, …)`` — see
 * {@link ../../srs/element-keys}) is not orphaned and no announcement is
 * needed:
 *
 * - ``word_tiles -> free_text``  — ``accept = [tiles.join(" ")]`` (VF).
 * - ``multiple_choice -> free_text`` — ``accept = [sorted-joined correct]``,
 *   the wrong options move to ``distractors`` (VA).
 *
 * The extension sources named in EXP-050 Stage 1
 * (``ext:al-dictation`` / ``ext:al-image-description``) are edited in a
 * SEPARATE authoring surface (``ExtensionExerciseEditor`` /
 * ``ExtensionSteps``); converting them to a core type crosses the ext/core
 * authoring-mode boundary and is a distinct, larger change deferred to a
 * follow-up.
 *
 * Framework-free so the mapping + the key-preservation check are
 * unit-testable and reusable by the later stages.
 *
 * @example
 * ```ts
 * if (coreConversionTargets(ex).includes("free_text")) {
 *   const next = convertExercise(ex, "free_text");
 *   // conversionPreservesElementKeys(ex, next) === true
 * }
 * ```
 */

import type {ContentLessonExercise} from "../../../storage/types";
import {elementKeysOf} from "../../srs/element-keys";
import {normalizeExerciseEdit} from "./exercise-edit";

/** The core exercise types whose content a Stage-1 conversion can carry into
 *  ``free_text`` without moving the element key. */
export type ConvertibleCoreType = "word_tiles" | "multiple_choice";

/** The only Stage-1 target. */
export type ConversionTargetType = "free_text";

const CONVERTIBLE_SOURCES: readonly ConvertibleCoreType[] = [
    "word_tiles",
    "multiple_choice",
];

/**
 * Top-level ``Exercise`` fields that belong to a specific type and MUST be
 * dropped when the exercise changes type, so the flat ``extra="forbid"``
 * schema never sees a field the new type does not declare.
 *
 * ``distractors`` is deliberately NOT here — it is a shared wrong-answer pool
 * that ``free_text`` and ``multiple_choice`` both carry, and a conversion
 * sets it explicitly. Identity/metadata fields (``id``, ``stable_id``,
 * ``prompt``, ``card_ids``, ``direction``, ``hint``, ``from_cards``,
 * ``examples``) are shared and pass through untouched.
 */
const TYPE_SPECIFIC_FIELDS = [
    "accept",
    "accept_orderings",
    "blanks",
    "cloze_mode",
    "ext_payload",
    "images",
    "multiple",
    "options",
    "pairs",
    "sentence",
    "tiles",
] as const;

/**
 * The Stage-1 conversion targets available for ``exercise``. Returns
 * ``["free_text"]`` for a convertible core source, otherwise ``[]`` (the UI
 * hides the type control when empty).
 */
export function coreConversionTargets(
    exercise: ContentLessonExercise,
): ConversionTargetType[] {
    return CONVERTIBLE_SOURCES.includes(exercise.type as ConvertibleCoreType)
        ? ["free_text"]
        : [];
}

/** Drop every type-specific field from a shallow copy, leaving the shared
 *  identity/metadata fields for the target type to build on. */
function stripTypeSpecificFields(
    exercise: ContentLessonExercise,
): ContentLessonExercise {
    const base: Record<string, unknown> = {...exercise};
    for (const field of TYPE_SPECIFIC_FIELDS) {
        delete base[field];
    }
    return base as unknown as ContentLessonExercise;
}

/** The single canonical ``free_text`` answer for a ``word_tiles`` source:
 *  the tiles joined by a space, matching the ``word_tiles`` element-key rule
 *  (``tiles.join(" ")``). */
function wordTilesAnswer(exercise: ContentLessonExercise): string {
    return (exercise.tiles ?? []).join(" ");
}

/** The correct/incorrect option split for a ``multiple_choice`` source. The
 *  accepted answer is the sorted-joined correct texts (matching the
 *  ``multiple_choice`` element-key rule); the incorrect texts become the
 *  ``distractors`` pool. */
function multipleChoiceAnswer(exercise: ContentLessonExercise): {
    accept: string;
    distractors: string[];
} {
    const options = exercise.options ?? [];
    const correct = options
        .filter((option) => option.correct === true)
        .map((option) => option.text)
        .sort()
        .join(", ");
    const distractors = options
        .filter((option) => option.correct !== true)
        .map((option) => option.text);
    return {accept: correct, distractors};
}

/**
 * Convert ``exercise`` to ``target``, carrying its content into the target
 * type's fields and dropping the source type's fields. Stage 1 supports only
 * ``-> free_text`` from a {@link ConvertibleCoreType}; any other source is
 * returned unchanged (the caller gates on {@link coreConversionTargets}).
 *
 * The result is a fresh object; ``id`` / ``stable_id`` are untouched so the
 * exercise-level SRS identity survives, and the derived ``accept[0]`` equals
 * the source's element key so the element-level history survives too (proven
 * by {@link conversionPreservesElementKeys}).
 */
export function convertExercise(
    exercise: ContentLessonExercise,
    target: ConversionTargetType,
): ContentLessonExercise {
    if (target !== "free_text") return exercise;
    // Derive from the NORMALIZED source (trimmed + empties dropped) so the
    // carried ``accept`` matches the element key the source contributes after
    // its own normalization — the equality {@link conversionPreservesElementKeys}
    // relies on, robust against an un-normalized in-editor draft.
    const source = normalizeExerciseEdit(exercise);
    const base = stripTypeSpecificFields(source);
    if (source.type === "word_tiles") {
        return {
            ...base,
            type: "free_text",
            accept: [wordTilesAnswer(source)],
        } as ContentLessonExercise;
    }
    if (source.type === "multiple_choice") {
        const {accept, distractors} = multipleChoiceAnswer(source);
        return {
            ...base,
            type: "free_text",
            accept: [accept],
            distractors,
        } as ContentLessonExercise;
    }
    return exercise;
}

/** Compare two element-key lists for exact, order-sensitive equality. */
function sameKeys(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((key, index) => key === b[index]);
}

/**
 * Whether converting ``source`` into ``converted`` leaves the SRS element-key
 * set unchanged, so the learner's card/error history stays resolvable. Both
 * exercises are measured after {@link normalizeExerciseEdit} (the shape that
 * is actually saved), and a ``null`` from either side (unknown type) counts
 * as NOT preserved — fail-closed, matching {@link elementKeysOf}.
 *
 * The Stage-1 conversions preserve keys by construction; this is the pure,
 * deterministic check EXP-050 requires the feature to compute, and the guard
 * the later (key-moving) stages will branch on.
 */
export function conversionPreservesElementKeys(
    source: ContentLessonExercise,
    converted: ContentLessonExercise,
): boolean {
    const before = elementKeysOf(normalizeExerciseEdit(source));
    const after = elementKeysOf(normalizeExerciseEdit(converted));
    if (before === null || after === null) return false;
    return sameKeys(before, after);
}
