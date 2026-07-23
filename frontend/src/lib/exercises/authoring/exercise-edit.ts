/**
 * Per-type validation + normalization for the Step-3 inline exercise
 * editor (#1844).
 *
 * The Lesson Creator generates exercises, then lets the author edit an
 * individual exercise's content in place. These pure helpers gate that
 * edit: {@link validateExerciseEdit} decides whether the current draft is
 * saveable (and, if not, returns the machine {@link ExerciseEditCode} of the
 * failed rule for the app to localize), and
 * {@link normalizeExerciseEdit} trims + drops empty entries and syncs a
 * cloze exercise's blanks to its marker count before the edit is committed
 * to the exercise record.
 *
 * Kept framework-free so the rules are unit-testable and shared by any
 * future consumer (the #1740 edit-lesson path reuses the same wizard).
 *
 * @example
 * ```ts
 * const issue = validateExerciseEdit(draft);
 * if (issue.valid) onSave(normalizeExerciseEdit(draft));
 * else showError(issue.code); // machine code, app maps to an i18n key
 * ```
 */

import type {
    ContentLessonClozeBlank,
    ContentLessonExercise,
} from "../../../storage/types";
import type {GeneratableType} from "./exercise-builder";
import {createIdFactory} from "./id-factory";

/** Minimum complete {left,right} pairs a matching exercise needs. */
export const MATCHING_MIN_PAIRS = 2;
/** Minimum accepted answers a free-text exercise needs. */
export const FREE_TEXT_MIN_ACCEPT = 1;
/** Minimum tiles a word-tiles exercise needs. */
export const WORD_TILES_MIN_TILES = 2;
/** Minimum image options a picture-choice exercise needs. */
export const PICTURE_MIN_IMAGES = 2;
/** Minimum answer options a multiple-choice exercise needs (#1850). */
export const MC_MIN_OPTIONS = 2;

/**
 * Machine code identifying which rule an exercise draft failed. App-neutral
 * on purpose (#1862): the kit reports WHAT is wrong, the app maps the code to
 * a localized message (see ``edit-error-keys.ts``). ``prompt`` is the shared
 * pre-check; the others match the exercise ``type``.
 */
export type ExerciseEditCode =
    | "prompt"
    | "matching"
    | "cloze"
    | "word_tiles"
    | "picture_choice"
    | "multiple_choice"
    | "free_text";

/** Result of validating an exercise draft: whether it is saveable and, when
 *  not, the machine {@link ExerciseEditCode} of the rule it failed. */
export interface ExerciseEditIssue {
    valid: boolean;
    code: ExerciseEditCode | null;
}

const ok: ExerciseEditIssue = {valid: true, code: null};

function fail(code: ExerciseEditCode): ExerciseEditIssue {
    return {valid: false, code};
}

/** Count the visible ``___`` blank markers in a cloze sentence. */
export function countClozeMarkers(sentence: string | null | undefined): number {
    if (!sentence) return 0;
    return (sentence.match(/___/g) ?? []).length;
}

function nonEmpty(values: string[] | null | undefined): string[] {
    return (values ?? []).map((v) => v.trim()).filter((v) => v.length > 0);
}

function validateMatching(ex: ContentLessonExercise): ExerciseEditIssue {
    const complete = (ex.pairs ?? []).filter(
        (p) => p.left.trim().length > 0 && p.right.trim().length > 0,
    );
    return complete.length >= MATCHING_MIN_PAIRS ? ok : fail("matching");
}

function validateFreeText(ex: ContentLessonExercise): ExerciseEditIssue {
    return nonEmpty(ex.accept).length >= FREE_TEXT_MIN_ACCEPT
        ? ok
        : fail("free_text");
}

function validateCloze(ex: ContentLessonExercise): ExerciseEditIssue {
    const markers = countClozeMarkers(ex.sentence);
    if (markers < 1) return fail("cloze");
    const blanks = ex.blanks ?? [];
    if (blanks.length !== markers) return fail("cloze");
    const everyBlankFilled = blanks.every(
        (b) => nonEmpty(b.accept).length >= 1,
    );
    return everyBlankFilled ? ok : fail("cloze");
}

function validateWordTiles(ex: ContentLessonExercise): ExerciseEditIssue {
    return nonEmpty(ex.tiles).length >= WORD_TILES_MIN_TILES
        ? ok
        : fail("word_tiles");
}

function validatePictureChoice(ex: ContentLessonExercise): ExerciseEditIssue {
    const images = ex.images ?? [];
    if (images.length < PICTURE_MIN_IMAGES) return fail("picture_choice");
    const allComplete = images.every(
        (img) => img.src.trim().length > 0 && img.label.trim().length > 0,
    );
    if (!allComplete) return fail("picture_choice");
    const correctCount = images.filter((img) => img.is_correct === "true").length;
    return correctCount === 1 ? ok : fail("picture_choice");
}

function validateMultipleChoice(ex: ContentLessonExercise): ExerciseEditIssue {
    const filled = (ex.options ?? []).filter((o) => o.text.trim().length > 0);
    if (filled.length < MC_MIN_OPTIONS) return fail("multiple_choice");
    // Option texts must be distinct (schema uniqueness is not ajv-enforced,
    // so this is the only guard).
    const texts = new Set(filled.map((o) => o.text.trim()));
    if (texts.size !== filled.length) return fail("multiple_choice");
    const correctCount = filled.filter((o) => o.correct === true).length;
    // multiple: at least one correct; single: exactly one correct.
    const okCount = ex.multiple === true ? correctCount >= 1 : correctCount === 1;
    return okCount ? ok : fail("multiple_choice");
}

/**
 * Validate an exercise draft for the inline editor. Checks the common
 * prompt first, then the type-specific structure. Returns the first
 * failure (as a machine {@link ExerciseEditCode}) or ``{valid: true}``.
 */
export function validateExerciseEdit(
    ex: ContentLessonExercise,
): ExerciseEditIssue {
    if (ex.prompt.trim().length < 1) return fail("prompt");
    switch (ex.type) {
        case "matching":
            return validateMatching(ex);
        case "cloze":
            return validateCloze(ex);
        case "word_tiles":
            return validateWordTiles(ex);
        case "picture_choice":
            return validatePictureChoice(ex);
        case "multiple_choice":
            return validateMultipleChoice(ex);
        case "free_text":
            return validateFreeText(ex);
        default:
            // Extension types have no inline editor yet; treat them as valid
            // so an unknown type is never blocked.
            return ok;
    }
}

/**
 * Normalize a validated exercise draft before it is committed: trim the
 * prompt, trim + drop empty type-specific entries, and sync a cloze
 * exercise's ``blanks`` to its ``___`` marker count. ``id``, ``type``,
 * ``card_ids``, ``distractors`` and every other field pass through
 * untouched.
 */
export function normalizeExerciseEdit(
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
 *  ``___`` marker count so ``len(blanks) == markers`` always holds. */
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
 * (e.g. 2 blank pairs), so {@link validateExerciseEdit} keeps them out of
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
