/**
 * hints/generate-hint — derive staged hints for an exercise (#590).
 *
 * Two sources, one ordered list: the author's own ``exercise.hint`` (when
 * the content carries one) comes FIRST, then the auto-generated stages
 * derived from the correct answer - a light level-1 hint (category /
 * length) and a stronger level-2 hint (first letters / a revealed pair).
 * The hints are returned as STRUCTURED data ({@link HintKind}) — i18n-free
 * and fully unit-testable — and the UI formats them with
 * {@link formatHint}. Returns ``[]`` when nothing can be offered (the
 * HintButton then hides).
 *
 * The authored stage is the #3168 merge: the per-renderer "Need a hint?"
 * links that used to show ``exercise.hint`` for free (bypassing the hint
 * economy, #594) are gone, so the XP button is the only hint surface and
 * the authored text is its first paid reveal. It is offered exactly where
 * those links used to live (cloze, free-text, word-tiles, audio-tiles);
 * matching stays hint-free by design (#2443).
 */

import {AUDIO_TILES_EXT_TYPE} from "../exercises/payload/audio-tiles";
import type {ContentLessonExercise} from "../../storage/types";

/** A structured hint, formatted into display text by {@link formatHint}. */
export type HintKind =
    | {kind: "authored"; text: string}
    | {kind: "length"; n: number}
    | {kind: "first_letters"; prefix: string; n: number}
    | {kind: "not"; label: string}
    | {kind: "item"; label: string};

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

/** The author's own ``exercise.hint`` as a level-1 stage; none when the
 *  content carries no (non-blank) hint. Shown verbatim by
 *  {@link formatHint}. */
function authoredHint(exercise: ContentLessonExercise): ExerciseHint[] {
    const text = exercise.hint?.trim() ?? "";
    if (text === "") return [];
    return [{level: 1, data: {kind: "authored", text}}];
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

/** Auto-generated stages only (no authored text), light → strong. */
function generatedHints(exercise: ContentLessonExercise): ExerciseHint[] {
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
            // #2443 — no hint for matching. Both columns are fully visible,
            // so a first-letter hint reveals a letter of an already-readable
            // word and "start with X" only names a visible item. Neither adds
            // information, so charging XP for it was a pure loss. The button
            // hides on an empty hint list. (Follow-up to #2390.)
            return [];
        case "word_tiles":
            return wordTilesHints(exercise);
        default:
            return [];
    }
}

/**
 * Build the staged hints for an exercise: the authored ``exercise.hint``
 * first (only for the types whose renderers offer authored hints), then
 * the generated stages, ordered light → strong. Empty when nothing can
 * be offered.
 */
export function generateHints(
    exercise: ContentLessonExercise,
): ExerciseHint[] {
    const generated = generatedHints(exercise);
    switch (exercise.type) {
        case "free_text":
        case "cloze":
        case "word_tiles":
        case AUDIO_TILES_EXT_TYPE:
            return [...authoredHint(exercise), ...generated];
        default:
            return generated;
    }
}

export type HintTranslate = (key: string, fallback?: string) => string;

/** Format a structured hint into display text using the i18n resolver. */
export function formatHint(hint: ExerciseHint, t: HintTranslate): string {
    const d = hint.data;
    switch (d.kind) {
        case "authored":
            return d.text;
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
    }
}
