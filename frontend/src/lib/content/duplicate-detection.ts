/**
 * Duplicate-lesson detection for community sharing (Phase 61).
 *
 * Before a user shares, we warn if a set with a very similar title
 * already exists in the SAME language pair + level — so the
 * community doesn't accumulate near-duplicate "French A1 greetings"
 * sets. Pure + testable; the Content page feeds it the already-
 * loaded set list (no extra fetch).
 */

import type { ContentSetEntry } from "../../storage/types";

function baseLang(code: string): string {
  return (code || "").split("-")[0].toLowerCase();
}

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    // German transliteration so "Begr\u00fc\u00dfung" == "Begruessung".
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip remaining combining diacritics
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Levenshtein edit distance, capped (returns >= cap+1 once it is
 *  certain the distance exceeds the cap, to stay cheap). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export interface DuplicateQuery {
  /** Set id of the lesson being shared (excluded from its own match). */
  id: string;
  title: string;
  source_language: string;
  target_language: string;
  level: string;
}

/**
 * Return the existing sets that look like duplicates of the set
 * being shared: same source + target language and level, and a
 * title that matches case-/diacritic-insensitively OR within a
 * Levenshtein distance < 3. User-generated sets (the sharer's own
 * "My Lessons") are never treated as duplicates.
 */
export function findSimilarSets(
  query: DuplicateQuery,
  candidates: ContentSetEntry[],
): ContentSetEntry[] {
  const qTitle = normaliseTitle(query.title);
  const qSource = baseLang(query.source_language);
  const qTarget = baseLang(query.target_language);
  const qLevel = (query.level || "").trim().toLowerCase();
  if (!qTitle) return [];
  return candidates.filter((c) => {
    if (c.id === query.id) return false;
    if (c.source === "user-generated") return false;
    if (baseLang(c.source_language) !== qSource) return false;
    if (baseLang(c.target_language) !== qTarget) return false;
    if ((c.level || "").trim().toLowerCase() !== qLevel) return false;
    const cTitle = normaliseTitle(c.title);
    if (!cTitle) return false;
    return cTitle === qTitle || levenshtein(cTitle, qTitle) < 3;
  });
}
