/**
 * Opportunistic migration of legacy hardcoded-English exercise prompts to
 * the UI language (#1860).
 *
 * Lessons generated before #1855 baked the English instruction templates
 * into every exercise ``prompt``. #1857 made new generation localize at
 * generation time; this closes the gap for EXISTING lessons — but only
 * when they are opened in the edit path (#1740), and only under a strict,
 * exact-match safety condition.
 *
 * SAFETY: a prompt is migrated ONLY when it is byte-identical to one of
 * the known old ``DEFAULT_EXERCISE_PROMPTS`` values. Since #1845 users can
 * hand-edit prompts, so any heuristic ("looks English") would risk
 * silently overwriting a deliberately-set prompt — a worse data-loss class
 * than the original bug. Exact match against the known constant is the only
 * condition that reliably distinguishes "unchanged old bug state" from
 * "the user set/left it". Reuses the shipped {@link localizedExercisePrompts}
 * (#1857) — no second localization logic.
 *
 * Pure + non-mutating: returns a new array; only migrated exercises are
 * shallow-copied. The result lives in the loaded edit state and is
 * persisted only when the user actually saves (no silent write).
 */

import {
    DEFAULT_EXERCISE_PROMPTS,
    type ExercisePrompts,
} from "./exercise-generator";
import {localizedExercisePrompts} from "./exercise-prompts";
import type {ContentLessonExercise} from "../../../../storage/types";

type Translate = (key: string, fallback?: string) => string;

/**
 * Maps an exercise ``type`` to its {@link ExercisePrompts} field. Only the
 * six core generated types ever carried a default prompt; every other type
 * (extension types, theory-derived, …) maps to ``undefined`` and is never
 * touched.
 */
const TYPE_TO_PROMPT_FIELD: Record<string, keyof ExercisePrompts | undefined> = {
    matching: "matching",
    free_text: "freeText",
    cloze: "cloze",
    word_tiles: "wordTiles",
    picture_choice: "pictureChoice",
    multiple_choice: "multipleChoice",
};

export interface LegacyPromptMigrationResult {
    /** The exercises, with migrated prompts replaced (others unchanged). */
    exercises: ContentLessonExercise[];
    /** How many prompts were migrated (0 = nothing to migrate). */
    migratedCount: number;
}

/**
 * Migrate any legacy hardcoded-English prompt to the UI language.
 *
 * @param exercises - The loaded lesson's exercises (not mutated).
 * @param t - The active i18n ``t`` function (drives the target language).
 * @returns The (possibly) rewritten exercises + a migrated count.
 *
 * @example
 * const {exercises, migratedCount} = migrateLegacyExercisePrompts(loaded, t);
 * if (migratedCount > 0) notifyUser();
 */
export function migrateLegacyExercisePrompts(
    exercises: ContentLessonExercise[],
    t: Translate,
): LegacyPromptMigrationResult {
    const localized = localizedExercisePrompts(t);
    let migratedCount = 0;
    const migrated = exercises.map((exercise) => {
        const field = TYPE_TO_PROMPT_FIELD[exercise.type];
        if (!field) return exercise;
        const oldDefault = DEFAULT_EXERCISE_PROMPTS[field];
        const localizedPrompt = localized[field];
        // Exact byte match against the known old default, AND the localized
        // form actually differs (an English UI is a no-op, never a rewrite).
        if (exercise.prompt === oldDefault && localizedPrompt !== oldDefault) {
            migratedCount += 1;
            return {...exercise, prompt: localizedPrompt};
        }
        return exercise;
    });
    return {exercises: migrated, migratedCount};
}
