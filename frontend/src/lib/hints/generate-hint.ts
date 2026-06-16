/**
 * hints/generate-hint — derive staged, auto-generated hints from an
 * exercise's correct answer, with no manual authoring (#590).
 *
 * Returns up to two ordered hints per exercise: a light level-1 hint
 * (category / length) and a stronger level-2 hint (first letters / a
 * revealed pair). The hints are returned as STRUCTURED data
 * ({@link HintKind}) — i18n-free and fully unit-testable — and the UI
 * formats them with {@link formatHint}. Returns ``[]`` when no answer
 * can be derived (the HintButton then hides).
 */

import type {ContentLessonExercise} from "../../storage/types";

/** A structured hint, formatted into display text by {@link formatHint}. */
export type HintKind =
    | {kind: "length"; n: number}
    | {kind: "first_letters"; prefix: string; n: number}
    | {kind: "not"; label: string}
    | {kind: "item"; label: string}
    | {kind: "reveal_pair"; left: string; right: string};

export interface ExerciseHint {
    /** 1 = light, 2 = stronger. */
    level: 1 | 2;
    data: HintKind;
}

function chars(s: string): string[] {
    return Array.from(s);
}

/** Length + first-letter hints for a single text answer. */
function textHints(answer: string): ExerciseHint[] {
    const trimmed = answer.trim();
    if (trimmed === "") return [];
    const letters = chars(trimmed);
    return [
        {level: 1, data: {kind: "length", n: letters.length}},
        {
            level: 2,
            data: {kind: "first_letters", prefix: letters[0], n: letters.length},
        },
    ];
}

function correctImageLabel(
    exercise: ContentLessonExercise,
): {correct: string; wrong: string | null} | null {
    const images = exercise.images ?? [];
    const correct = images.find((i) => i.is_correct === "true");
    if (!correct || !correct.label) return null;
    const wrong = images.find(
        (i) => i.is_correct !== "true" && i.label && i.label !== correct.label,
    );
    return {correct: correct.label, wrong: wrong?.label ?? null};
}

/** Picture-choice hints: rule out a wrong label, then reveal the
 *  correct label's first letter + length. */
function pictureChoiceHints(exercise: ContentLessonExercise): ExerciseHint[] {
    const labels = correctImageLabel(exercise);
    if (!labels) return [];
    const hints: ExerciseHint[] = [];
    if (labels.wrong) {
        hints.push({level: 1, data: {kind: "not", label: labels.wrong}});
    }
    const letters = chars(labels.correct.trim());
    if (letters.length > 0) {
        hints.push({
            level: 2,
            data: {kind: "first_letters", prefix: letters[0], n: letters.length},
        });
    }
    return hints;
}

/** Matching hints: name the first item, then reveal its pair. */
function matchingHints(exercise: ContentLessonExercise): ExerciseHint[] {
    const pair = exercise.pairs?.[0];
    if (!pair || !pair.left || !pair.right) return [];
    return [
        {level: 1, data: {kind: "item", label: pair.left}},
        {
            level: 2,
            data: {kind: "reveal_pair", left: pair.left, right: pair.right},
        },
    ];
}

/** Word-tiles hints: the first tile, then the first two. */
function wordTilesHints(exercise: ContentLessonExercise): ExerciseHint[] {
    const tiles = (exercise.tiles ?? []).filter((tt) => tt.trim() !== "");
    if (tiles.length === 0) return [];
    const hints: ExerciseHint[] = [
        {level: 1, data: {kind: "item", label: tiles[0]}},
    ];
    if (tiles.length > 1) {
        hints.push({
            level: 2,
            data: {kind: "item", label: tiles.slice(0, 2).join(" ")},
        });
    }
    return hints;
}

/**
 * Build the staged hints for an exercise. Up to two hints, ordered
 * light → strong. Empty when the answer can't be derived.
 */
export function generateHints(
    exercise: ContentLessonExercise,
): ExerciseHint[] {
    switch (exercise.type) {
        case "free_text": {
            const answer = exercise.accept?.[0];
            return answer ? textHints(answer) : [];
        }
        case "cloze": {
            const answer = exercise.blanks?.[0]?.accept?.[0];
            return answer ? textHints(answer) : [];
        }
        case "picture_choice":
            return pictureChoiceHints(exercise);
        case "matching":
            return matchingHints(exercise);
        case "word_tiles":
            return wordTilesHints(exercise);
        default:
            return [];
    }
}

export type HintTranslate = (key: string, fallback?: string) => string;

/** Format a structured hint into display text using the i18n resolver. */
export function formatHint(hint: ExerciseHint, t: HintTranslate): string {
    const d = hint.data;
    switch (d.kind) {
        case "length":
            return t("hints.length", "The answer has {n} letters").replace(
                "{n}",
                String(d.n),
            );
        case "first_letters":
            return t(
                "hints.first_letters",
                "It starts with “{prefix}” ({n} letters)",
            )
                .replace("{prefix}", d.prefix)
                .replace("{n}", String(d.n));
        case "not":
            return t("hints.not", "It's not “{label}”").replace(
                "{label}",
                d.label,
            );
        case "item":
            return t("hints.item", "Start with “{label}”").replace(
                "{label}",
                d.label,
            );
        case "reveal_pair":
            return t("hints.reveal_pair", "“{left}” goes with “{right}”")
                .replace("{left}", d.left)
                .replace("{right}", d.right);
    }
}
