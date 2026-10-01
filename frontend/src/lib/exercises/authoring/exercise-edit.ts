/**
 * Normalization and shared helpers for the Step-3 inline exercise editor
 * (#1844).
 *
 * The Lesson Creator generates exercises, then lets the author edit an
 * individual exercise's content in place. {@link normalizeExerciseEdit}
 * trims + drops empty entries and syncs a blank-based cloze exercise's
 * blanks to its marker count before the edit is committed to the exercise
 * record (a ``multiselect`` cloze has no blanks and keeps none, #3246).
 *
 * Whether a draft is saveable is not decided here: the Lesson Creator asks
 * ``checkExerciseDraft`` (``lib/content/lesson/exercise-draft-check``), which
 * defers to the schema and the engine's rules (#3387). This module only
 * names the failed rule as an {@link ExerciseEditCode} the app localizes.
 *
 * Kept framework-free so the helpers are unit-testable and shared by any
 * future consumer (the #1740 edit-lesson path reuses the same wizard).
 *
 * @example
 * ```ts
 * onSave(normalizeExerciseEdit(draft));
 * ```
 */

import type {
    ContentLessonClozeBlank,
    ContentLessonExercise,
} from "../../../storage/types";
import type {GeneratableType} from "./exercise-builder";
import {createIdFactory} from "./id-factory";

/** Hard cap on the post-answer ``explanation`` (engine schema 1.13, #2992). */
export const EXPLANATION_MAX_CHARS = 2000;

/**
 * Machine code identifying which rule an exercise draft failed. App-neutral
 * on purpose (#1862): the check reports WHAT is wrong, the app maps the code
 * to a localized message (see ``edit-error-keys.ts``). ``prompt`` and
 * ``explanation`` are the shared pre-checks; the others name an engine rule
 * or, for a finding no rule names, the exercise ``type`` (#3387).
 */
export type ExerciseEditCode =
    | "prompt"
    | "explanation"
    | "matching_pairs"
    | "matching_duplicate_left"
    | "matching_from_cards"
    | "cloze"
    | "cloze_distractors"
    | "cloze_multiselect"
    | "word_tiles"
    | "word_tiles_ordering"
    | "picture_choice"
    | "multiple_choice"
    | "free_text"
    | "card_ref";

/** Result of validating an exercise draft: whether it is saveable and, when
 *  not, the machine {@link ExerciseEditCode} of the rule it failed. */
export interface ExerciseEditIssue {
    valid: boolean;
    code: ExerciseEditCode | null;
}

/** Count the visible ``___`` blank markers in a cloze sentence. */
export function countClozeMarkers(sentence: string | null | undefined): number {
    if (!sentence) return 0;
    return (sentence.match(/___/g) ?? []).length;
}

function nonEmpty(values: string[] | null | undefined): string[] {
    return (values ?? []).map((v) => v.trim()).filter((v) => v.length > 0);
}

/** True when the draft's ``explanation`` (trimmed) exceeds the schema cap
 *  (#2992). An absent or blank explanation is always fine - the field is
 *  optional on every exercise type. */
export function explanationTooLong(ex: ContentLessonExercise): boolean {
    return (ex.explanation ?? "").trim().length > EXPLANATION_MAX_CHARS;
}

/**
 * Normalize the optional ``explanation`` (#2992): trim it, and DROP the key
 * when nothing is left, so a lesson whose author never touched the field
 * serializes exactly as before (no ``explanation: ""`` noise in the JSON).
 * Shared by the core and the extension normalizers.
 */
export function normalizeExplanation(
    ex: ContentLessonExercise,
): ContentLessonExercise {
    const text = (ex.explanation ?? "").trim();
    if (text.length > 0) return {...ex, explanation: text};
    if (!("explanation" in ex)) return ex;
    const stripped = {...ex};
    delete stripped.explanation;
    return stripped;
}

/**
 * Normalize a validated exercise draft before it is committed: trim the
 * prompt, trim + drop empty type-specific entries, sync a cloze
 * exercise's ``blanks`` to its ``___`` marker count, and trim / drop the
 * optional ``explanation`` (#2992). ``id``, ``type``, ``card_ids``,
 * ``distractors`` and every other field pass through untouched.
 */
export function normalizeExerciseEdit(
    ex: ContentLessonExercise,
): ContentLessonExercise {
    return normalizeExplanation(normalizeTypeFields(ex));
}

/** The per-type half of {@link normalizeExerciseEdit}. */
function normalizeTypeFields(
    ex: ContentLessonExercise,
): ContentLessonExercise {
    const prompt = ex.prompt.trim();
    switch (ex.type) {
        case "matching":
            return {
                ...ex,
                prompt,
                pairs: (ex.pairs ?? [])
                    .map((p) => ({left: p.left.trim(), right: p.right.trim()}))
                    .filter((p) => p.left.length > 0 && p.right.length > 0),
            };
        case "free_text":
            return {...ex, prompt, accept: nonEmpty(ex.accept)};
        case "word_tiles":
            return {...ex, prompt, tiles: nonEmpty(ex.tiles)};
        case "cloze":
            if (ex.cloze_mode === "multiselect") {
                const {blanks: _stray, ...rest} = ex;
                return {
                    ...rest,
                    prompt,
                    // The question is the sentence (#1195): trimmed like
                    // the prompt, so a blank one is empty, not "   ".
                    sentence: ex.sentence?.trim() ?? ex.sentence,
                    accept: nonEmpty(ex.accept),
                    distractors: nonEmpty(ex.distractors),
                };
            }
            return {...ex, prompt, blanks: normalizeClozeBlanks(ex)};
        case "picture_choice":
            return {
                ...ex,
                prompt,
                images: (ex.images ?? []).map((img) => ({
                    src: img.src.trim(),
                    label: img.label.trim(),
                    ...(img.is_correct === "true"
                        ? {is_correct: "true"}
                        : {}),
                })),
            };
        case "multiple_choice":
            return {
                ...ex,
                prompt,
                multiple: ex.multiple === true,
                options: (ex.options ?? [])
                    .map((o) => ({text: o.text.trim(), correct: o.correct === true}))
                    .filter((o) => o.text.length > 0),
            };
        default:
            return {...ex, prompt};
    }
}

/** Trim per-blank accepts and pad/trim the blanks array to the sentence's
 *  ``___`` marker count so ``len(blanks) == markers`` holds for the
 *  blank-based ``type`` / ``select`` modes (never called for
 *  ``multiselect``, which has no blanks, #3246). */
function normalizeClozeBlanks(
    ex: ContentLessonExercise,
): ContentLessonClozeBlank[] {
    const markers = countClozeMarkers(ex.sentence);
    const source = ex.blanks ?? [];
    const out: ContentLessonClozeBlank[] = [];
    for (let i = 0; i < markers; i++) {
        out.push({...source[i], accept: nonEmpty(source[i]?.accept)});
    }
    return out;
}

const manualExerciseIds = createIdFactory("ex-manual");

/** Stable-ish unique id for a manually-added exercise (#1849). Distinct from
 *  the generator's ``ex-<n>-<type>`` ids so the two never collide. Backed by a
 *  default {@link IdFactory}; inject {@link createIdFactory} for an isolated
 *  sequence (#1862). */
export function newExerciseId(): string {
    return manualExerciseIds.next();
}

/**
 * Build an EMPTY exercise of the given type for the manual "+ Add exercise"
 * entry point (#1849). Same ``ContentLessonExercise`` shape a generated
 * exercise has — only the id differs — so a manual exercise is
 * indistinguishable downstream. The empty starts are deliberately invalid
 * (e.g. 2 blank pairs), so ``checkExerciseDraft`` (#3387) keeps them out of
 * step 4 until the author fills them in the inline editor.
 */
export function createBlankExercise(
    type: GeneratableType,
    id: string,
): ContentLessonExercise {
    const base = {id, prompt: "", card_ids: [], distractors: []};
    switch (type) {
        case "matching":
            return {
                ...base,
                type,
                pairs: [
                    {left: "", right: ""},
                    {left: "", right: ""},
                ],
            } as ContentLessonExercise;
        case "free_text":
            return {...base, type, accept: []} as ContentLessonExercise;
        case "cloze":
            return {
                ...base,
                type,
                sentence: "___",
                blanks: [{accept: []}],
                cloze_mode: "type",
            } as ContentLessonExercise;
        case "word_tiles":
            return {...base, type, tiles: ["", ""]} as ContentLessonExercise;
        case "picture_choice":
            return {
                ...base,
                type,
                images: [
                    {src: "", label: ""},
                    {src: "", label: ""},
                ],
            } as ContentLessonExercise;
        case "multiple_choice":
            return {
                ...base,
                type,
                multiple: false,
                options: [
                    {text: "", correct: false},
                    {text: "", correct: false},
                ],
            } as ContentLessonExercise;
    }
}
