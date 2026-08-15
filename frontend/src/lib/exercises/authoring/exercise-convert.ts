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
 * - ``word_tiles -> free_text``  — ``accept = [tiles.join(" ")]`` (key-preserving).
 * - ``multiple_choice -> free_text`` — ``accept = [sorted-joined correct]``,
 *   the wrong options move to ``distractors`` (key-preserving).
 * - ``ext:al-dictation -> free_text`` / ``ext:al-image-description ->
 *   free_text`` — the tolerated transcriptions/answers in ``ext_payload.accept``
 *   become the top-level ``accept``; the audio/image stimulus is dropped
 *   (key-preserving).
 * - ``ext:al-error-correction -> free_text`` — ``accept = ext_payload.accept``;
 *   the ``tokens`` sentence is dropped. Key-preserving: the error-correction
 *   element key IS ``accept[0]`` (Stage 2, #2511).
 * - ``cloze -> free_text`` — ``accept = blanks[0].accept`` (the ``type`` /
 *   ``select`` modes). A single blank preserves the key; several blanks drop to
 *   one and MOVE it, so the caller shows a progress announcement first, gated on
 *   {@link conversionPreservesElementKeys} (Stage 2). The edit-save remap
 *   (``carryOverReviewProgress``, #2519/#2566) still reports the moved rows.
 *
 * Stage 3 also completes BETWEEN the passage-quiz extension types:
 * ``ext:al-graded-quiz <-> ext:al-reading-comprehension`` — the questions carry
 * over; GQ->RC starts an empty ``passage`` (RC requires one, the validator
 * blocks Save until it is written) and strips the per-question ``points``, RC->GQ
 * drops the passage and gives each question a default weight (valid at once).
 *
 * The two conversion FAMILIES map onto the two inline editors:
 * {@link coreConversionTargets} feeds the core ``ExerciseEditor`` (word_tiles /
 * multiple_choice / cloze / free_text), {@link extensionConversionTargets} feeds
 * ``ExtensionExerciseEditor``. A conversion that CROSSES into a core type
 * (``ext:* -> free_text``) is offered only where a core exercise is valid (the
 * ``ExerciseGenerator`` row, saved via the core lesson path), never in the
 * ext-only ``ExtensionSteps`` flow; the ext<->ext RC/GQ pair rides the same
 * gate for uniformity.
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
import {DICTATION_EXT_TYPE, asDictationPayload} from "../payload/dictation";
import {
    IMAGE_DESCRIPTION_EXT_TYPE,
    asImageDescriptionPayload,
} from "../payload/image-description";
import {
    ERROR_CORRECTION_EXT_TYPE,
    asErrorCorrectionPayload,
} from "../payload/error-correction";
import {
    READING_COMPREHENSION_EXT_TYPE,
    asReadingComprehensionPayload,
    type RcQuestion,
} from "../payload/reading-comprehension";
import {
    GRADED_QUIZ_EXT_TYPE,
    asGradedQuizPayload,
    type GqQuestion,
} from "../payload/graded-quiz";

/** The core exercise types whose content a conversion can carry into
 *  ``free_text``. ``word_tiles`` / ``multiple_choice`` preserve the key by
 *  construction (Stage 1); ``cloze`` preserves it for a single blank and
 *  MOVES it for several (Stage 2 — the announcement covers the move). */
export type ConvertibleCoreType = "word_tiles" | "multiple_choice" | "cloze";

/** The extension exercise types whose ``ext_payload.accept`` a conversion can
 *  carry into ``free_text``. dictation / image-description drop a media
 *  stimulus (Stage 1); error-correction is key-preserving too — its element
 *  key IS ``accept[0]`` (Stage 2). */
export type ConvertibleExtensionType =
    | typeof DICTATION_EXT_TYPE
    | typeof IMAGE_DESCRIPTION_EXT_TYPE
    | typeof ERROR_CORRECTION_EXT_TYPE;

/** The exercise types a conversion can produce. ``free_text`` is the
 *  key-preserving target (Stage 1/2); ``multiple_choice`` / ``cloze`` and the
 *  reading-comprehension / graded-quiz pair are the Stage-3 COMPLETION targets
 *  — they build a draft with a field the author fills (empty ``passage``, empty
 *  MC option), gated by the existing validator. */
export type ConversionTargetType =
    | "free_text"
    | "multiple_choice"
    | "cloze"
    | typeof READING_COMPREHENSION_EXT_TYPE
    | typeof GRADED_QUIZ_EXT_TYPE;

/** Per-source core conversion targets. The ``-> free_text`` sources carry a
 *  single answer out; ``free_text`` converts INTO the richer types (Stage 3),
 *  seeding what it can and leaving the rest for the author. */
const CORE_CONVERSION_TARGETS: Record<string, ConversionTargetType[]> = {
    word_tiles: ["free_text"],
    multiple_choice: ["free_text"],
    cloze: ["free_text"],
    free_text: ["multiple_choice", "cloze"],
};

/** Per-source extension conversion targets. The media/correction sources carry
 *  a single answer out to ``free_text``; the passage-quiz pair converts between
 *  each other (Stage 3b), completing the field the target needs. */
const EXTENSION_CONVERSION_TARGETS: Record<string, ConversionTargetType[]> = {
    [DICTATION_EXT_TYPE]: ["free_text"],
    [IMAGE_DESCRIPTION_EXT_TYPE]: ["free_text"],
    [ERROR_CORRECTION_EXT_TYPE]: ["free_text"],
    [GRADED_QUIZ_EXT_TYPE]: [READING_COMPREHENSION_EXT_TYPE],
    [READING_COMPREHENSION_EXT_TYPE]: [GRADED_QUIZ_EXT_TYPE],
};

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
 * The conversion targets available for a CORE ``exercise``. Returns
 * ``["free_text"]`` for a convertible core source, otherwise ``[]`` (the UI
 * hides the type control when empty).
 *
 * ``multiselect`` cloze is excluded: its answer lives in the top-level
 * ``accept`` set (not per-blank), so it is a different mapping than the
 * blank-based ``type`` / ``select`` cloze this covers — deferred.
 */
export function coreConversionTargets(
    exercise: ContentLessonExercise,
): ConversionTargetType[] {
    if (exercise.type === "cloze" && exercise.cloze_mode === "multiselect") {
        return [];
    }
    return CORE_CONVERSION_TARGETS[exercise.type] ?? [];
}

/**
 * The Stage-1 conversion targets available for an EXTENSION ``exercise``.
 * Returns ``["free_text"]`` for ``ext:al-dictation`` / ``ext:al-image-description``,
 * otherwise ``[]``. Consumed by ``ExtensionExerciseEditor`` — and only where a
 * core ``free_text`` result is valid (see the module note); the ext-only
 * ``ExtensionSteps`` flow does not offer it.
 */
export function extensionConversionTargets(
    exercise: ContentLessonExercise,
): ConversionTargetType[] {
    return EXTENSION_CONVERSION_TARGETS[exercise.type] ?? [];
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

/** The tolerated answers of an extension source, read from ``ext_payload`` and
 *  cleaned. For dictation / image-description a media stimulus is dropped; for
 *  error-correction the ``tokens`` sentence is dropped. In every case
 *  ``accept[0]`` is the source's canonical answer (its element key), so the
 *  resulting ``free_text.accept`` preserves it. */
function extensionAcceptAnswers(exercise: ContentLessonExercise): string[] {
    const accept =
        exercise.type === DICTATION_EXT_TYPE
            ? asDictationPayload(exercise)?.accept
            : exercise.type === IMAGE_DESCRIPTION_EXT_TYPE
              ? asImageDescriptionPayload(exercise)?.accept
              : asErrorCorrectionPayload(exercise)?.accept;
    return (accept ?? [])
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

/** The accepted answers a ``cloze`` carries into ``free_text``: the FIRST
 *  blank's accepts (the blank-based ``type`` / ``select`` modes). A single
 *  blank preserves the key; several blanks drop to one and MOVE it (the
 *  announcement covers that — see {@link conversionPreservesElementKeys}). */
function clozeAcceptAnswers(exercise: ContentLessonExercise): string[] {
    return (exercise.blanks?.[0]?.accept ?? [])
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

/**
 * Build the ``multiple_choice`` draft a ``free_text`` converts into (Stage 3).
 * The accepted answer becomes the single correct option; the free-text
 * ``distractors`` pool, if any, seeds the wrong options — otherwise ONE empty
 * option keeps the draft incomplete so the shared validator blocks Save until
 * the author adds a real alternative. Key-preserving: the one correct option
 * text equals ``accept[0]``.
 */
function freeTextToMultipleChoice(
    source: ContentLessonExercise,
): {multiple: boolean; options: {text: string; correct: boolean}[]} {
    const correctText = source.accept?.[0]?.trim() ?? "";
    const wrong = (source.distractors ?? [])
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((text) => ({text, correct: false}));
    return {
        multiple: false,
        options: [
            {text: correctText, correct: true},
            ...(wrong.length > 0 ? wrong : [{text: "", correct: false}]),
        ],
    };
}

/**
 * Build the ``cloze`` draft a ``free_text`` converts into (Stage 3). A single
 * ``___`` blank carries the accepted answer, so the draft is a valid one-blank
 * cloze that the author expands into a real sentence. ``type`` mode; the key
 * (``blanks[0].accept[0]``) equals ``accept[0]``, so it is preserved.
 */
function freeTextToCloze(source: ContentLessonExercise): {
    sentence: string;
    cloze_mode: "type";
    blanks: {accept: string[]}[];
} {
    return {
        sentence: "___",
        cloze_mode: "type",
        blanks: [{accept: source.accept ?? []}],
    };
}

/** A sub-question kept as-is minus its grading fields — the reading-comprehension
 *  shape (``{prompt, type, options?/accept?}``). Stripping ``points`` /
 *  ``partial_credit`` matters: the flat ``extra="forbid"`` schema rejects them
 *  on an RC question. */
function toRcQuestion(question: GqQuestion): RcQuestion {
    const rc: RcQuestion = {prompt: question.prompt, type: question.type};
    if (question.options !== undefined) rc.options = question.options;
    if (question.accept !== undefined) rc.accept = question.accept;
    return rc;
}

/** A sub-question given a default weight — the graded-quiz shape. Reading
 *  comprehension carries no ``points``; a graded quiz requires positive points,
 *  so a default of 1 makes each carried question immediately valid. */
function toGqQuestion(question: RcQuestion): GqQuestion {
    const gq: GqQuestion = {prompt: question.prompt, type: question.type, points: 1};
    if (question.options !== undefined) gq.options = question.options;
    if (question.accept !== undefined) gq.accept = question.accept;
    return gq;
}

/** Build the ``reading-comprehension`` draft a ``graded-quiz`` converts into
 *  (Stage 3b). The questions carry over (grading fields stripped) but a passage
 *  is REQUIRED and the quiz has none, so it starts empty — the RC validator
 *  blocks Save until the author writes it. */
function gradedQuizToReadingComprehension(exercise: ContentLessonExercise): {
    passage: string;
    questions: RcQuestion[];
} {
    const questions = asGradedQuizPayload(exercise)?.questions ?? [];
    return {passage: "", questions: questions.map(toRcQuestion)};
}

/** Build the ``graded-quiz`` draft a ``reading-comprehension`` converts into
 *  (Stage 3b). The passage is dropped; each question gets a default weight, so
 *  the draft is immediately valid. */
function readingComprehensionToGradedQuiz(exercise: ContentLessonExercise): {
    pass_threshold: number;
    questions: GqQuestion[];
} {
    const questions = asReadingComprehensionPayload(exercise)?.questions ?? [];
    return {pass_threshold: 60, questions: questions.map(toGqQuestion)};
}

/**
 * Convert ``exercise`` to ``target``, carrying its content into the target
 * type's fields and dropping the source type's fields. Handles the
 * ``-> free_text`` conversions (Stage 1/2) and the ``free_text ->
 * multiple_choice`` / ``free_text -> cloze`` COMPLETION conversions (Stage 3);
 * any unsupported ``(source, target)`` pair returns the exercise unchanged (the
 * caller gates on {@link coreConversionTargets} /
 * {@link extensionConversionTargets}).
 *
 * The result is a fresh object; ``id`` / ``stable_id`` are untouched so the
 * exercise-level SRS identity survives, and the derived answer preserves the
 * source's element key (proven by {@link conversionPreservesElementKeys}). A
 * completion target may return an INTENTIONALLY INVALID draft (a
 * ``multiple_choice`` with one empty option) so the shared validator blocks
 * Save until the author completes it.
 */
export function convertExercise(
    exercise: ContentLessonExercise,
    target: ConversionTargetType,
): ContentLessonExercise {
    // Derive from the NORMALIZED source (trimmed + empties dropped) so the
    // carried answer matches the element key the source contributes after its
    // own normalization — the equality {@link conversionPreservesElementKeys}
    // relies on, robust against an un-normalized in-editor draft.
    const source = normalizeExerciseEdit(exercise);
    const base = stripTypeSpecificFields(source);
    if (target === "free_text") {
        return toFreeText(source, base) ?? exercise;
    }
    if (target === "multiple_choice" && source.type === "free_text") {
        return {
            ...base,
            type: "multiple_choice",
            distractors: [],
            ...freeTextToMultipleChoice(source),
        } as ContentLessonExercise;
    }
    if (target === "cloze" && source.type === "free_text") {
        return {
            ...base,
            type: "cloze",
            distractors: [],
            ...freeTextToCloze(source),
        } as ContentLessonExercise;
    }
    if (
        target === READING_COMPREHENSION_EXT_TYPE &&
        source.type === GRADED_QUIZ_EXT_TYPE
    ) {
        return {
            ...base,
            type: READING_COMPREHENSION_EXT_TYPE,
            ext_payload: gradedQuizToReadingComprehension(source),
        } as ContentLessonExercise;
    }
    if (
        target === GRADED_QUIZ_EXT_TYPE &&
        source.type === READING_COMPREHENSION_EXT_TYPE
    ) {
        return {
            ...base,
            type: GRADED_QUIZ_EXT_TYPE,
            ext_payload: readingComprehensionToGradedQuiz(source),
        } as ContentLessonExercise;
    }
    return exercise;
}

/** The ``-> free_text`` mapping (Stage 1/2): one canonical answer carried out
 *  of the source, source-type fields dropped. Returns ``null`` for a source
 *  with no free-text conversion so the caller can pass the exercise through. */
function toFreeText(
    source: ContentLessonExercise,
    base: ContentLessonExercise,
): ContentLessonExercise | null {
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
    if (source.type === "cloze") {
        return {
            ...base,
            type: "free_text",
            accept: clozeAcceptAnswers(source),
        } as ContentLessonExercise;
    }
    if (
        source.type === DICTATION_EXT_TYPE ||
        source.type === IMAGE_DESCRIPTION_EXT_TYPE ||
        source.type === ERROR_CORRECTION_EXT_TYPE
    ) {
        return {
            ...base,
            type: "free_text",
            accept: extensionAcceptAnswers(source),
        } as ContentLessonExercise;
    }
    return null;
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
