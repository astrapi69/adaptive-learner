/**
 * Pure search + filter + sort over the EXP-034 discovery index.
 *
 * The "Inhalte entdecken" page (DIS-05) loads {@link SearchableSet}[] via the
 * DIS-04 loader and renders them. All of the matching / filtering / sorting
 * logic lives here so it is unit-testable without React: the page only wires
 * state + UI to these pure functions.
 *
 * Library-First (Phase 1): native ``Array.filter`` + normalized
 * ``String.includes`` — no fuzzy-search library. Normalization reuses the
 * Content-Browser's {@link normalizeSearchText} (case- + accent- + German-
 * digraph-insensitive) so "Gruesse" finds "Grüße".
 */

import { isOfficialSource } from "./content-repos";
import { normalizeSearchText } from "../content-search";
import type { SearchableSet } from "./search-index-loader";

/** Minimal shape of a locally-cached set, for download-state matching. */
export interface LocalCachedSet {
  source: string;
  id: string;
  cached_version: string | null;
}

/**
 * True when a discovered set is already downloaded locally.
 *
 * Matches on set id + source. Official content is special-cased: the index
 * advertises it under the canonical ``owner/repo`` source, but it may be
 * cached locally under a ``bundled:`` source — so two official sources with
 * the same id count as a match.
 */
export function isSetDownloaded(
  set: SearchableSet,
  localCached: LocalCachedSet[],
): boolean {
  return localCached.some((local) => {
    if (local.cached_version === null) return false;
    if (local.id !== set.id) return false;
    if (local.source === set.repo_url) return true;
    return isOfficialSource(local.source) && isOfficialSource(set.repo_url);
  });
}

/** Sort orders offered by the discovery list. */
export type DiscoverSort = "relevance" | "newest" | "lessons";

/** Filter state. Empty string = "all" for every facet. */
export interface DiscoverFilters {
  /** Free-text query (matched against name + description + tags). */
  query: string;
  /** BCP-47 code matched against source OR target language. */
  language: string;
  /** CEFR level (a1..c2), exact match. */
  level: string;
  /** Content domain (language / ai / psychology / …), exact match. */
  domain: string;
  /** Minimum trust level as a string ("1" | "2" | "3"); "" = any. */
  trust: string;
  /** "yes" → AI-validated only, "no" → not validated, "" → any. */
  aiChecked: string;
}

/** A blank filter set (everything = all). */
export const EMPTY_FILTERS: DiscoverFilters = {
  query: "",
  language: "",
  level: "",
  domain: "",
  trust: "",
  aiChecked: "",
};

/** Build the normalized haystack for one set (name + description + tags). */
function setHaystack(set: SearchableSet): string {
  return normalizeSearchText([set.name, set.description, ...set.tags].join(" "));
}

/** True when the set matches the normalized free-text query (empty = match). */
export function matchesQuery(set: SearchableSet, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return setHaystack(set).includes(normalizedQuery);
}

/** True when the set passes every active (non-empty) facet of ``filters``. */
export function passesFilters(set: SearchableSet, filters: DiscoverFilters): boolean {
  if (
    filters.language &&
    set.source_language !== filters.language &&
    set.target_language !== filters.language
  ) {
    return false;
  }
  if (filters.level && set.level !== filters.level) return false;
  if (filters.domain && set.domain !== filters.domain) return false;
  if (filters.trust) {
    const min = Number(filters.trust);
    if (Number.isFinite(min) && set.trust_level < min) return false;
  }
  if (filters.aiChecked === "yes" && !set.ai_validated) return false;
  if (filters.aiChecked === "no" && set.ai_validated) return false;
  return true;
}

/** Relevance score for an active query: name match outweighs a tag match. */
function relevanceScore(set: SearchableSet, normalizedQuery: string): number {
  if (!normalizedQuery) return set.trust_level;
  let score = 0;
  if (normalizeSearchText(set.name).includes(normalizedQuery)) score += 4;
  if (set.tags.some((t) => normalizeSearchText(t).includes(normalizedQuery))) score += 2;
  if (normalizeSearchText(set.description).includes(normalizedQuery)) score += 1;
  return score;
}

function compareByName(a: SearchableSet, b: SearchableSet): number {
  return a.name.localeCompare(b.name);
}

/** Sort a copy of ``sets`` by the chosen order (stable, never mutates input). */
export function sortDiscoverSets(
  sets: SearchableSet[],
  sort: DiscoverSort,
  query: string,
): SearchableSet[] {
  const nq = normalizeSearchText(query);
  const copy = [...sets];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => {
        const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
        const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
        return tb - ta || compareByName(a, b);
      });
    case "lessons":
      return copy.sort(
        (a, b) => b.lesson_count - a.lesson_count || compareByName(a, b),
      );
    case "relevance":
    default:
      return copy.sort((a, b) => {
        const diff = relevanceScore(b, nq) - relevanceScore(a, nq);
        return diff !== 0 ? diff : compareByName(a, b);
      });
  }
}

/** Filter + sort in one pass. Returns a new array. */
export function queryDiscoverSets(
  sets: SearchableSet[],
  filters: DiscoverFilters,
  sort: DiscoverSort,
): SearchableSet[] {
  const nq = normalizeSearchText(filters.query);
  const filtered = sets.filter(
    (set) => matchesQuery(set, nq) && passesFilters(set, filters),
  );
  return sortDiscoverSets(filtered, sort, filters.query);
}

/** Distinct BCP-47 codes present across all sets (source + target), sorted. */
export function availableLanguages(sets: SearchableSet[]): string[] {
  const codes = new Set<string>();
  for (const set of sets) {
    if (set.source_language) codes.add(set.source_language);
    if (set.target_language) codes.add(set.target_language);
  }
  return [...codes].sort();
}

/** Distinct CEFR levels present, sorted (a1, a2, b1, …). */
export function availableLevels(sets: SearchableSet[]): string[] {
  const levels = new Set<string>();
  for (const set of sets) if (set.level) levels.add(set.level);
  return [...levels].sort();
}

/** Distinct domains present, sorted. */
export function availableDomains(sets: SearchableSet[]): string[] {
  const domains = new Set<string>();
  for (const set of sets) if (set.domain) domains.add(set.domain);
  return [...domains].sort();
}

/** Stable identity key for a discovered set (source + id). */
export function discoverSetKey(set: { repo_url: string; id: string }): string {
  return `${set.repo_url}::${set.id}`;
}
