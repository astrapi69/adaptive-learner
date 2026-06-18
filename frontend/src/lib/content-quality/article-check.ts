/**
 * CQV-02 article check (EXP-032) — flag noun-article pairs whose article
 * contradicts the noun's gender (``la libro`` -> ``el libro``,
 * ``der Mädchen`` -> ``das Mädchen``).
 *
 * Pure + deterministic. Scans each card's target-language ``front`` for
 * ``article + noun`` bigrams; when the noun is in the conservative,
 * single-gender {@link NOUN_DICTS} and the article's gender (from
 * {@link ARTICLES}) disagrees, it reports the correct article. Gender-
 * neutral articles (fr ``les``/``des``) and ambiguous ones (de ``ein``)
 * carry no signal and are skipped.
 *
 * @example
 * checkArticles([{ id: "c1", front: "la libro" }], "es")
 * // -> [{ card_id: "c1", noun: "libro", expected_article: "el", actual: "la" }]
 */

import { ARTICLES, correctArticle } from "./data/articles";
import { NOUN_DICTS } from "./data/nouns";
import { baseLang, foldToken, wordTokens } from "./normalize";
import type { ArticleFinding, QualityCard } from "./types";

/** Flag gender-mismatched article+noun pairs in each card's ``front``. */
export function checkArticles(
  cards: readonly QualityCard[],
  targetLanguage: string,
): ArticleFinding[] {
  const lang = baseLang(targetLanguage);
  const articles = ARTICLES[lang];
  const nouns = NOUN_DICTS[lang];
  if (!articles || !nouns) return [];
  const findings: ArticleFinding[] = [];
  for (const card of cards) {
    const tokens = wordTokens(card.front);
    for (let i = 0; i < tokens.length - 1; i++) {
      const spec = articles[tokens[i].toLowerCase()];
      // Skip non-articles and gender-neutral articles (no signal).
      if (!spec || spec.gender === null) continue;
      const noun = tokens[i + 1];
      const gender = nouns[foldToken(noun.toLowerCase())];
      if (!gender || gender === spec.gender) continue;
      const expected = correctArticle(lang, gender, spec.number, spec.definite);
      if (!expected) continue;
      findings.push({
        card_id: card.id,
        noun,
        expected_article: expected,
        actual: tokens[i].toLowerCase(),
      });
    }
  }
  return findings;
}
