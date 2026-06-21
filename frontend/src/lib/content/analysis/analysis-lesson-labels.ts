/**
 * Localized label set for {@link generateLessonFromAnalysis}.
 *
 * Extracted (#826 / AIX-02) so the import-detail page and the
 * Save-as-Offline-Lesson modal build the SAME base lesson from a chat
 * analysis — the page needs it to decide whether a "Generate exercises"
 * button applies (theory-only lesson) and to feed the theory prose to the
 * AI; the modal needs it to render + save. Keeping one builder means the
 * two surfaces can never drift on the label strings.
 */

import type { AnalysisLessonLabels } from "./analysis-to-lesson";

type Translate = (key: string, fallback?: string) => string;

/** Build the localized {@link AnalysisLessonLabels} from a ``t`` fn. */
export function analysisLessonLabels(t: Translate): AnalysisLessonLabels {
  return {
    fallbackTitle: t("content.lesson_gen.fallback_title", "Imported lesson"),
    focusLabel: t("content.lesson_gen.focus", "Focus"),
    topicsTitle: t("content.lesson_gen.topics", "Topics"),
    strengthsTitle: t("content.lesson_gen.strengths", "What you already know"),
    weaknessesTitle: t("content.lesson_gen.weaknesses", "What we will work on"),
    errorPatternsTitle: t("content.lesson_gen.errors", "Common mistakes"),
    matchingPrompt: t(
      "content.lesson_gen.match_prompt",
      "Match each word with its translation.",
    ),
    freeTextPrompt: t("content.lesson_gen.free_prompt", "Translate: {word}"),
    clozePrompt: t("content.lesson_gen.cloze_prompt", "Fill in the missing word."),
    wordTilesPrompt: t(
      "content.lesson_gen.tiles_prompt",
      "Arrange the words into the sentence ({word}).",
    ),
  };
}
