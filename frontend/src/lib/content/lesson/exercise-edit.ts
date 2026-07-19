/**
 * Per-type validation + normalization for the Step-3 inline exercise
 * editor (#1844).
 *
 * The Lesson Creator generates exercises, then lets the author edit an
 * individual exercise's content in place. These pure helpers gate that
 * edit: {@link validateExerciseEdit} decides whether the current draft is
 * saveable (and, if not, which translated message to show), and
 * {@link normalizeExerciseEdit} trims + drops empty entries and syncs a
 * cloze exercise's blanks to its marker count before the edit is committed
 * to the exercise record.
 *
 * Kept framework-free so the rules are unit-testable and shared by any
 * future consumer (the #1740 edit-lesson path reuses the same wizard).
 */

import type {
    ContentLessonClozeBlank,
    ContentLessonExercise,
} from "../../../storage/types";

/** Minimum complete {left,right} pairs a matching exercise needs. */
export const MATCHING_MIN_PAIRS = 2;
/** Minimum accepted answers a free-text exercise needs. */
export const FREE_TEXT_MIN_ACCEPT = 1;
/** Minimum tiles a word-tiles exercise needs. */
export const WORD_TILES_MIN_TILES = 2;
/** Minimum image options a picture-choice exercise needs. */
export const PICTURE_MIN_IMAGES = 2;

const ERR = "create_lesson.exercises.edit.err_";

/** Result of validating an exercise draft: whether it is saveable and, when
 *  not, the i18n key of the message to show. */
export interface ExerciseEditIssue {
    valid: boolean;
    errorKey: string | null;
}

const ok: ExerciseEditIssue = {valid: true, errorKey: null};

function fail(suffix: string): ExerciseEditIssue {
    return {valid: false, errorKey: `${ERR}${suffix}`};
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

/**
 * Validate an exercise draft for the inline editor. Checks the common
 * prompt first, then the type-specific structure. Returns the first
 * failure (as an i18n key) or ``{valid: true}``.
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
        case "free_text":
            return validateFreeText(ex);
        default:
            // Extension / multiple_choice types have no inline editor yet;
            // treat them as valid so an unknown type is never blocked.
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
