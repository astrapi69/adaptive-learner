/**
 * Knowledge-vs-language domain decision (#149, shared by #1226 / EXP-041).
 *
 * Several exercise renderers must drop the translation-specific wording
 * ("translate", column "Translation", "Build the translation") when a
 * lesson is NOT language learning. That happens in two cases:
 *
 *   - the lesson declares a non-language ``domain``
 *     ("programming" | "psychology" | …), or
 *   - the source and target language are the same (de->de), i.e. the set
 *     teaches knowledge in one language rather than a translation pair.
 *
 * ``MatchingExercise`` introduced this rule in #149; ``DirectionInstruction``
 * (word_tiles / free_text / picture_choice) reuses the EXACT same decision
 * via this one helper, so the two surfaces can never drift.
 *
 * Library-grade: pure, no app-state / network imports.
 */

/**
 * True when the lesson should use knowledge wording instead of
 * language-learning (translation) wording.
 *
 * @param domain - The lesson domain ("language" | "programming" | …) or null.
 * @param sourceLanguage - BCP-47 source language (what the learner speaks).
 * @param targetLanguage - BCP-47 target language (what the learner learns).
 * @returns ``true`` for a non-language domain or a same-language pair.
 */
export function isKnowledgeDomain(
  domain: string | null | undefined,
  sourceLanguage: string | null | undefined,
  targetLanguage: string | null | undefined,
): boolean {
  return (
    (domain != null && domain !== "language") ||
    (!!targetLanguage && targetLanguage === sourceLanguage)
  );
}
