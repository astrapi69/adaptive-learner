/**
 * Localized instruction templates for the deterministic exercise
 * generator (#1855).
 *
 * The generator itself stays library-grade (no i18n import); this thin
 * wrapper builds a full {@link ExercisePrompts} from a ``t`` function so
 * every generating surface (the Create-Lesson wizard today) localizes
 * the templates to the user's UI language AT GENERATION TIME — the
 * prompt strings are stored in the lesson JSON, so whatever language
 * they are generated in is what the lesson keeps.
 *
 * The keys mirror the chat-analysis path (``analysisLessonLabels``) so
 * the two generating surfaces share one catalog entry per template;
 * ``pic_prompt`` is creator-only (the analysis path emits no
 * picture-choice exercises).
 *
 * The ``{word}`` placeholder is replaced with the card front — the
 * foreign-language learning content itself — and stays untranslated.
 *
 * @example
 * const exercises = generateExercises(cards, config, {
 *     prompts: localizedExercisePrompts(t),
 * });
 */

import type {ExercisePrompts} from "../../../exercises";

type Translate = (key: string, fallback?: string) => string;

/** Build the localized {@link ExercisePrompts} from a ``t`` fn. */
export function localizedExercisePrompts(t: Translate): ExercisePrompts {
    return {
        matching: t(
            "content.lesson_gen.match_prompt",
            "Match each word with its translation.",
        ),
        freeText: t("content.lesson_gen.free_prompt", "Translate: {word}"),
        cloze: t(
            "content.lesson_gen.cloze_prompt",
            "Fill in the missing word.",
        ),
        wordTiles: t(
            "content.lesson_gen.tiles_prompt",
            "Arrange the words into the sentence ({word}).",
        ),
        pictureChoice: t(
            "content.lesson_gen.pic_prompt",
            "Pick the image for: {word}",
        ),
        multipleChoice: t(
            "content.lesson_gen.mc_prompt",
            "Choose the correct translation of: {word}",
        ),
    };
}
