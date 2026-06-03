/**
 * Client-side search index for the Content Browser.
 *
 * The library is small enough (~225 lessons x ~15 cards) to search
 * entirely in the browser with no backend: the Content page builds an
 * index once (from the already-cached sets + lessons) and re-queries it
 * on every (debounced) keystroke.
 *
 * Matching is normalized substring search:
 *   - case-insensitive
 *   - diacritic-insensitive (NFD-fold: e matches é, c matches ç)
 *   - German digraph aware (ue matches ü, oe matches ö, ae matches ä,
 *     ss matches ß) so a learner without an umlaut keyboard still finds
 *     "Grüße" by typing "Gruesse"
 *
 * Pure + deterministic (no React, no i18n) so it is unit-testable. The
 * Content page assembles the {@link IndexedSet}[] (it has the i18n
 * domain labels + the loaded lessons) and renders {@link splitHighlight}
 * segments; everything pedagogical lives here.
 */

/** Minimum normalized query length before a search is "active". */
export const MIN_QUERY_LENGTH = 2;

/** One searchable lesson: a pre-normalized haystack + its display refs. */
export interface IndexedLesson {
  filename: string;
  title: string;
  /** Normalized title + card fronts/backs + tags. */
  haystack: string;
}

/** One searchable set: set-level haystack + its lessons. */
export interface IndexedSet {
  setId: string;
  source: string;
  /** Normalized title + description + domain label + tags. */
  setHaystack: string;
  lessons: IndexedLesson[];
}

export interface MatchedLesson {
  filename: string;
  title: string;
}

export interface ContentSearchMatch {
  setId: string;
  source: string;
  /** True when the set-level fields (title/description/domain) matched. */
  setMatched: boolean;
  matchedLessons: MatchedLesson[];
}

export interface ContentSearchResult {
  /** True once the normalized query reaches {@link MIN_QUERY_LENGTH}. */
  active: boolean;
  query: string;
  matches: ContentSearchMatch[];
  /** Total lessons surfaced across all matches (the result count). */
  lessonCount: number;
}

/** Lowercase, expand German digraphs, then NFD-fold remaining diacritics.
 *
 * Order matters: lowercasing first means ``Ü`` becomes ``ü`` before the
 * digraph map; the umlaut expansion runs before the NFD strip so ``ü``
 * becomes ``ue`` (not ``u``). */
export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Build the normalized haystack for a lesson. ``cards`` is the lesson's
 *  card list (front + back + optional per-card tags). */
export function buildLessonHaystack(
  title: string,
  cards: { front?: string | null; back?: string | null; tags?: string[] | null }[],
  tags: string[] = [],
): string {
  const parts: string[] = [title, ...tags];
  for (const card of cards) {
    if (card.front) parts.push(card.front);
    if (card.back) parts.push(card.back);
    if (card.tags) parts.push(...card.tags);
  }
  return normalizeSearchText(parts.join(" "));
}

/** Build the normalized set-level haystack (title + description + the
 *  localized domain label + tags). */
export function buildSetHaystack(
  title: string,
  description: string | null | undefined,
  domainLabel: string,
  tags: string[] = [],
): string {
  return normalizeSearchText(
    [title, description ?? "", domainLabel, ...tags].join(" "),
  );
}

/** Query the index. Returns ``active: false`` until the normalized query
 *  reaches {@link MIN_QUERY_LENGTH}. A set is included when its
 *  set-level fields match OR it has matching lessons; a set-level-only
 *  match surfaces all of the set's lessons so the learner can pick. */
export function searchContentIndex(
  index: IndexedSet[],
  rawQuery: string,
): ContentSearchResult {
  const nq = normalizeSearchText(rawQuery);
  if (nq.length < MIN_QUERY_LENGTH) {
    return { active: false, query: rawQuery, matches: [], lessonCount: 0 };
  }
  const matches: ContentSearchMatch[] = [];
  let lessonCount = 0;
  for (const set of index) {
    const setMatched = set.setHaystack.includes(nq);
    const matchedLessons = set.lessons
      .filter((lesson) => lesson.haystack.includes(nq))
      .map((lesson) => ({ filename: lesson.filename, title: lesson.title }));
    if (setMatched && matchedLessons.length === 0) {
      // Set title/description/domain matched but no individual lesson;
      // surface every lesson in the set.
      const all = set.lessons.map((lesson) => ({
        filename: lesson.filename,
        title: lesson.title,
      }));
      matches.push({
        setId: set.setId,
        source: set.source,
        setMatched: true,
        matchedLessons: all,
      });
      lessonCount += all.length;
    } else if (setMatched || matchedLessons.length > 0) {
      matches.push({
        setId: set.setId,
        source: set.source,
        setMatched,
        matchedLessons,
      });
      lessonCount += matchedLessons.length;
    }
  }
  return { active: true, query: rawQuery, matches, lessonCount };
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/** Split ``text`` into segments around case-insensitive occurrences of
 *  ``query`` so the UI can bold the matched parts. Best-effort on the
 *  RAW text (diacritic-folded index matches may not light up every
 *  occurrence, but the row is still shown). */
export function splitHighlight(
  text: string,
  query: string,
): HighlightSegment[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const segments: HighlightSegment[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  let cursor = 0;
  let found = lowerText.indexOf(lowerQuery, cursor);
  while (found !== -1) {
    if (found > cursor) {
      segments.push({ text: text.slice(cursor, found), match: false });
    }
    segments.push({
      text: text.slice(found, found + q.length),
      match: true,
    });
    cursor = found + q.length;
    found = lowerText.indexOf(lowerQuery, cursor);
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }
  return segments.length > 0 ? segments : [{ text, match: false }];
}
