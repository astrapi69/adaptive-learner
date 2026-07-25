/**
 * Relevance ordering for the /content set list.
 *
 * The source catalogues arrive in manifest order, and until now the page
 * rendered that order verbatim: a German-speaking user saw whatever set
 * happened to be listed first (historically the Hindi-source pairs).
 * This sort puts the sets whose source_language matches the user's UI
 * language first; the manifest order stays the fallback within both
 * groups and for users without a matching language.
 */

import type { ContentSetEntry } from "../../../storage/types";

/** Base language of a BCP-47-ish code ("pt-BR" -> "pt"); empty stays empty. */
function baseLanguage(code: string | null | undefined): string {
  return (code ?? "").split("-")[0].toLowerCase();
}

/**
 * Stable partition of the catalogue by relevance to the user's UI
 * language: sets whose `source_language` base code matches come first,
 * everything else follows, and the incoming (manifest/index) order is
 * preserved within both groups.
 *
 * Returns the INPUT ARRAY when the order would not change (already
 * ordered, no match, or no user language): the downstream `[sets]`-keyed
 * effects rely on referential stability between renders.
 */
export function sortSetsByLanguageRelevance(
  sets: ContentSetEntry[],
  userLanguage: string,
): ContentSetEntry[] {
  const userBase = baseLanguage(userLanguage);
  if (!userBase) return sets;

  const matching: ContentSetEntry[] = [];
  const remaining: ContentSetEntry[] = [];
  for (const setEntry of sets) {
    if (baseLanguage(setEntry.source_language) === userBase) {
      matching.push(setEntry);
    } else {
      remaining.push(setEntry);
    }
  }
  if (matching.length === 0 || remaining.length === 0) return sets;

  const reordered = [...matching, ...remaining];
  const unchanged = reordered.every((setEntry, index) => setEntry === sets[index]);
  return unchanged ? sets : reordered;
}
