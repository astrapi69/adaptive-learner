/**
 * Per-exercise-type element-attempt derivers
 * (Phase 46B / C9 / P-129).
 *
 * Each exercise component (Matching / PictureChoice /
 * FreeText / WordTiles) calls the matching helper when
 * building its onComplete payload (C10). The helper produces
 * the ``ElementAttempt[]`` the viewer then passes to
 * ``elementErrors.recordBulk``.
 *
 * D2 (Phase 46 plan) — element_key derivation rules:
 *
 *   matching       → one attempt per pair; key = pair.left
 *   picture_choice → one attempt; key = correct image's label
 *   free_text      → one attempt; key = accept[0] canonical
 *   word_tiles     → one attempt; key = tiles.join(" ")
 *                    canonical
 *
 * Lesson-scoped uniqueness lives in the composite
 * ``(user_id, set_id, lesson_id, exercise_id, element_key)``
 * — the element_key alone doesn't need to be globally unique.
 *
 * Heuristic ``element_type``:
 *   - matching / picture_choice / free_text → "vocabulary"
 *   - word_tiles with 2+ tiles → "grammar_rule" (phrases
 *     test ordering = grammar)
 *   - word_tiles with 1 tile (edge case) → "vocabulary"
 */

import {resolveConcreteDirection} from "../exercises/direction";
import type {ContentLessonExercise, ElementAttempt} from "../../storage/types";

export interface AttemptContext {
    setId: string;
    /** The lesson filename or id; whatever the viewer uses
     *  to address the cached lesson. */
    lessonId: string;
}

function _baseAttempt(
    exercise: ContentLessonExercise,
    ctx: AttemptContext,
): Pick<ElementAttempt, "set_id" | "lesson_id" | "exercise_id" | "direction"> {
    return {
        set_id: ctx.setId,
        lesson_id: ctx.lessonId,
        exercise_id: exercise.id,
        // EXP-018 / Phase 62: stamp the exercise's concrete drill
        // direction on every attempt so the SRS layer tracks
        // receptive vs productive mastery independently. Resolved
        // centrally here so all five exercise types agree.
        direction: resolveConcreteDirection(exercise.direction, exercise.id),
    };
}

/** MATCHING: fan-out one attempt per pair. ``matches`` maps
 *  the user's left-tile index → the right-tile's
 *  originalIndex from the authored ``pairs`` list. A pair is
 *  correct when the matched right tile's VALUE equals the value the
 *  left pair expects (``.left`` in a productive drill, ``.right``
 *  otherwise), so duplicate right-column values (e.g. "el" for both
 *  ``libro`` and ``coche``) are interchangeable rather than
 *  index-bound. */
export function deriveMatchingAttempts(
    exercise: ContentLessonExercise,
    ctx: AttemptContext,
    matches: ReadonlyMap<number, number>,
    productive = false,
): ElementAttempt[] {
    const pairs = exercise.pairs ?? [];
    const rightValue = (i: number): string =>
        (productive ? pairs[i]?.left : pairs[i]?.right) ?? "";
    return pairs.map((pair, leftIdx) => {
        const userRightOriginalIdx = matches.get(leftIdx);
        const userPairingText =
            userRightOriginalIdx !== undefined
                ? (pairs[userRightOriginalIdx]?.right ?? "")
                : "";
        const correct =
            userRightOriginalIdx !== undefined &&
            rightValue(userRightOriginalIdx) === rightValue(leftIdx);
        return {
            ..._baseAttempt(exercise, ctx),
            element_key: pair.left,
            element_type: "vocabulary",
            user_answer: userPairingText,
            correct_answer: pair.right,
            correct,
        };
    });
}

/** PICTURE_CHOICE: single attempt. element_key = the correct
 *  image's label so reviews on this element re-target the
 *  same concept regardless of which wrong tile the user
 *  picked. */
export function derivePictureChoiceAttempt(
    exercise: ContentLessonExercise,
    ctx: AttemptContext,
    selectedIndex: number,
): ElementAttempt {
    const images = exercise.images ?? [];
    const correctImage = images.find((img) => img.is_correct === "true");
    const selected = images[selectedIndex];
    const correctLabel = correctImage?.label ?? "";
    return {
        ..._baseAttempt(exercise, ctx),
        element_key: correctLabel,
        element_type: "vocabulary",
        user_answer: selected?.label ?? "",
        correct_answer: correctLabel,
        correct: selected !== undefined && selected.is_correct === "true",
    };
}

/** FREE_TEXT: single attempt. element_key = ``accept[0]``
 *  (the canonical first entry). ``correct`` is computed by
 *  the FreeTextExercise component via the C1
 *  ``isFreeTextCorrect`` matcher; the deriver doesn't
 *  re-validate. */
export function deriveFreeTextAttempt(
    exercise: ContentLessonExercise,
    ctx: AttemptContext,
    userInput: string,
    isCorrect: boolean,
): ElementAttempt {
    const canonical = exercise.accept?.[0] ?? "";
    return {
        ..._baseAttempt(exercise, ctx),
        element_key: canonical,
        element_type: "vocabulary",
        user_answer: userInput,
        correct_answer: canonical,
        correct: isCorrect,
    };
}

/** WORD_TILES: single attempt. element_key = the canonical
 *  ``tiles.join(" ")`` phrase. element_type defaults to
 *  ``grammar_rule`` for multi-tile (the exercise tests
 *  ordering, which IS grammar) and falls back to
 *  ``vocabulary`` for the single-tile edge case. */
export function deriveWordTilesAttempt(
    exercise: ContentLessonExercise,
    ctx: AttemptContext,
    placedOrder: readonly number[],
    isCorrect: boolean,
): ElementAttempt {
    const tiles = exercise.tiles ?? [];
    const canonical = tiles.join(" ");
    const userAnswer = placedOrder
        .map((i) => tiles[i] ?? "")
        .join(" ");
    return {
        ..._baseAttempt(exercise, ctx),
        element_key: canonical,
        element_type: tiles.length > 1 ? "grammar_rule" : "vocabulary",
        user_answer: userAnswer,
        correct_answer: canonical,
        correct: isCorrect,
    };
}

/** CLOZE: fan-out one attempt per blank (Phase 52D / v1.35.0 /
 *  P-127). Note the plural name — cloze emits MULTIPLE attempts
 *  per exercise, one per blank, so element-level mastery
 *  granularity matches the granularity of the wrong-answer
 *  signal. element_key per blank = ``blank.accept[0]`` (the
 *  canonical of THAT blank), so a user who fluently fills
 *  blank A but consistently misses blank B gets per-blank
 *  mastery tracking — the cloze generator (52E) can then
 *  target blank B specifically. */
export function deriveClozeAttempts(
    exercise: ContentLessonExercise,
    ctx: AttemptContext,
    perBlankInputs: readonly string[],
    perBlankCorrect: readonly boolean[],
): ElementAttempt[] {
    const blanks = exercise.blanks ?? [];
    return blanks.map((blank, i) => {
        const canonical = blank.accept[0] ?? "";
        return {
            ..._baseAttempt(exercise, ctx),
            element_key: canonical,
            element_type: "vocabulary",
            user_answer: perBlankInputs[i] ?? "",
            correct_answer: canonical,
            correct: perBlankCorrect[i] ?? false,
        };
    });
}

/** CLOZE multiselect (#1195): a single attempt for the whole
 *  'select all that apply' question. element_key + correct_answer are
 *  the canonical correct set (sorted, joined) so reviews re-target the
 *  same question; ``correct`` is the exact-set verdict from the
 *  component (no re-validation here). */
export function deriveClozeMultiSelectAttempt(
    exercise: ContentLessonExercise,
    ctx: AttemptContext,
    selected: readonly string[],
    isCorrect: boolean,
): ElementAttempt {
    const canonical = [...(exercise.accept ?? [])].sort().join(", ");
    return {
        ..._baseAttempt(exercise, ctx),
        element_key: canonical,
        element_type: "vocabulary",
        user_answer: [...selected].sort().join(", "),
        correct_answer: canonical,
        correct: isCorrect,
    };
}

/** Native multiple_choice (#1525, schema v1.6): a single attempt for the
 *  question. element_key + correct_answer are the canonical correct
 *  option texts (sorted, joined) so reviews re-target the same question;
 *  ``correct`` is the verdict from the grading module (single pick or
 *  exact-set, no re-validation here). */
export function deriveMultipleChoiceAttempt(
    exercise: ContentLessonExercise,
    ctx: AttemptContext,
    selected: readonly string[],
    isCorrect: boolean,
): ElementAttempt {
    const canonical = (exercise.options ?? [])
        .filter((option) => option.correct === true)
        .map((option) => option.text)
        .sort()
        .join(", ");
    return {
        ..._baseAttempt(exercise, ctx),
        element_key: canonical,
        element_type: "vocabulary",
        user_answer: [...selected].sort().join(", "),
        correct_answer: canonical,
        correct: isCorrect,
    };
}
