/**
 * CQV-01 accent check (EXP-032) — flag target-language words that are
 * missing a required diacritic (``cafe`` -> ``café``, ``etre`` -> ``être``,
 * ``uber`` -> ``über``).
 *
 * Pure + deterministic, no network or model. For each card's ``front``
 * (the target-language term), every token is folded (lowercased, diacritics
 * stripped) and looked up in the per-language {@link ACCENT_DICTS}. A hit
 * whose written form differs from the dictionary's accented form is a
 * missing accent.
 *
 * @example
 * checkAccents([{ id: "c1", front: "cafe" }], "es")
 * // -> [{ card_id: "c1", field: "front", word: "cafe", expected: "café" }]
 */

import { ACCENT_DICTS } from "./data/accents";
import { baseLang, foldToken, wordTokens } from "./normalize";
import type { AccentFinding, QualityCard } from "./types";

/** Flag missing diacritics in each card's target-language ``front``. */
export function checkAccents(
  cards: readonly QualityCard[],
  targetLanguage: string,
): AccentFinding[] {
  const dict = ACCENT_DICTS[baseLang(targetLanguage)];
  if (!dict) return [];
  const findings: AccentFinding[] = [];
  for (const card of cards) {
    const seen = new Set<string>();
    for (const token of wordTokens(card.front)) {
      const lower = token.toLowerCase();
      const expected = dict[foldToken(lower)];
      // Hit, and the written form lacks the accent (differs from the
      // correct one). De-dupe repeated words within a card.
      if (expected && expected !== lower && !seen.has(lower)) {
        seen.add(lower);
        findings.push({
          card_id: card.id,
          field: "front",
          word: token,
          expected,
        });
      }
    }
  }
  return findings;
}
