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
import { normalizeSearchText } from "../browse/content-search";
import { isKnowledgeDomain } from "../../exercises/knowledge-domain";
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
  /** Entry point / task preset (EXP-048 #2331): ``"language"`` shows language
   *  sets (a source→target pair), ``"knowledge"`` shows knowledge sets
   *  (non-language domain OR same-language pair), ``""`` shows everything. A
   *  Vorbelegung over ONE list, not a partition — the discriminator is
   *  ``isKnowledgeDomain``, so no schema field is needed. */
  entry: string;
  /** Free-text query (matched against name + description + tags). */
  query: string;
  /** BCP-47 code matched against the set's SOURCE (instruction) language.
   *  The visible, locale-defaulted, persisted language facet (#1343). */
  sourceLanguage: string;
  /** BCP-47 code matched against the set's TARGET (learned) language
   *  (EXP-048 #2322). ``""`` = every target. With the source language this
   *  is the pair a language learner searches by; ``target_language`` is in
   *  45/45 index entries but was never filterable before. */
  targetLanguage: string;
  /** CEFR level (a1..c2), exact match. */
  level: string;
  /** Content domain (language / ai / psychology / …), exact match. */
  domain: string;
  /** Minimum trust level as a string ("1" | "2" | "3"); "" = any. */
  trust: string;
  /** Review-standing facet (EXP-048 #2321). Exact match on the set's
   *  ``review_status``: ``"authored"`` keeps only hand-written sets
   *  ("Ohne Maschinen-Sets"), ``"reviewed"`` keeps only reviewed machine
   *  sets ("Nur durchgesehen"), ``""`` = any. Replaces the retired
   *  ``aiChecked`` facet (1 of 45 sets ``ai_validated`` — a facet that
   *  filtered out 44 of 45 results or did nothing). */
  reviewStatus: string;
  /** Source (repo) facet (EXP-048 #2330): exact match on ``repo_url``, so the
   *  learner can see and restrict WHICH source results come from. ``""`` =
   *  every source. Discover searches all validated + own repos regardless of
   *  the Settings source management; this facet makes that transparent. */
  source: string;
}

/** A blank filter set (everything = all). */
export const EMPTY_FILTERS: DiscoverFilters = {
  entry: "",
  query: "",
  sourceLanguage: "",
  targetLanguage: "",
  level: "",
  domain: "",
  trust: "",
  reviewStatus: "",
  source: "",
};

/** Resolve a BCP-47 code to a display name in the active UI language, so the
 *  language names are searchable in the UI language (EXP-048 #2329). */
export type LanguageNameResolver = (code: string) => string;

/** Build the normalized haystack for one set: name + description + tags, plus
 *  the UI-language names of the source + target language when a resolver is
 *  given (EXP-048 #2329) — so an English-UI learner typing "Spanish" finds a
 *  German-authored "Spanisch A1" set whose visible name is in German. */
function setHaystack(set: SearchableSet, languageNames?: LanguageNameResolver): string {
  const parts = [set.name, set.description, ...set.tags];
  if (languageNames) {
    if (set.source_language) parts.push(languageNames(set.source_language));
    if (set.target_language) parts.push(languageNames(set.target_language));
  }
  return normalizeSearchText(parts.join(" "));
}

/** True when the set matches the normalized free-text query (empty = match).
 *  Pass ``languageNames`` to also search the pair's UI-language names. */
export function matchesQuery(
  set: SearchableSet,
  normalizedQuery: string,
  languageNames?: LanguageNameResolver,
): boolean {
  if (!normalizedQuery) return true;
  return setHaystack(set, languageNames).includes(normalizedQuery);
}

/** True when the set passes every active (non-empty) facet of ``filters``. */
export function passesFilters(set: SearchableSet, filters: DiscoverFilters): boolean {
  if (filters.entry) {
    const knowledge = isKnowledgeDomain(
      set.domain,
      set.source_language,
      set.target_language,
    );
    if (filters.entry === "language" && knowledge) return false;
    if (filters.entry === "knowledge" && !knowledge) return false;
  }
  if (filters.sourceLanguage && set.source_language !== filters.sourceLanguage) {
    return false;
  }
  if (filters.targetLanguage && set.target_language !== filters.targetLanguage) {
    return false;
  }
  if (filters.level && set.level !== filters.level) return false;
  if (filters.domain && set.domain !== filters.domain) return false;
  if (filters.trust) {
    const min = Number(filters.trust);
    if (Number.isFinite(min) && set.trust_level < min) return false;
  }
  if (filters.reviewStatus && set.review_status !== filters.reviewStatus) {
    return false;
  }
  if (filters.source && set.repo_url !== filters.source) return false;
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

/** Filter + sort in one pass. Returns a new array. ``languageNames`` (optional)
 *  makes the pair's UI-language names searchable (EXP-048 #2329). */
export function queryDiscoverSets(
  sets: SearchableSet[],
  filters: DiscoverFilters,
  sort: DiscoverSort,
  languageNames?: LanguageNameResolver,
): SearchableSet[] {
  const nq = normalizeSearchText(filters.query);
  const filtered = sets.filter(
    (set) =>
      // #1707 — render-time visibility gate. ``normalizeSet`` already drops
      // ``visibility: "hidden"`` entries at parse (keeping facets/cache clean),
      // so this guards any ``SearchableSet`` reaching the query by another path
      // (a stale/injected cache entry). Absent ⇒ visible.
      set.visibility !== "hidden" &&
      matchesQuery(set, nq, languageNames) &&
      passesFilters(set, filters),
  );
  return sortDiscoverSets(filtered, sort, filters.query);
}

/** Distinct non-empty SOURCE (instruction) language codes present, sorted.
 *  Drives the visible source-language facet (#1343). */
export function availableSourceLanguages(sets: SearchableSet[]): string[] {
  const codes = new Set<string>();
  for (const set of sets) if (set.source_language) codes.add(set.source_language);
  return [...codes].sort();
}

/** How many sets carry each SOURCE language code (for "Deutsch (12)" labels). */
export function sourceLanguageCounts(
  sets: SearchableSet[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const set of sets) {
    if (!set.source_language) continue;
    counts[set.source_language] = (counts[set.source_language] ?? 0) + 1;
  }
  return counts;
}

/** Distinct non-empty TARGET (learned) language codes present, sorted.
 *  Drives the target-language facet (EXP-048 #2322). */
export function availableTargetLanguages(sets: SearchableSet[]): string[] {
  const codes = new Set<string>();
  for (const set of sets) if (set.target_language) codes.add(set.target_language);
  return [...codes].sort();
}

/** How many sets carry each TARGET language code (for "Español (3)" labels
 *  and count-sorting the target facet). */
export function targetLanguageCounts(
  sets: SearchableSet[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const set of sets) {
    if (!set.target_language) continue;
    counts[set.target_language] = (counts[set.target_language] ?? 0) + 1;
  }
  return counts;
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

/** One source (repo) present in the catalogue, with its display name + count. */
export interface DiscoverSource {
  /** ``owner/repo`` identity (the filter value). */
  url: string;
  /** Curated repo title, else ``owner/repo``. */
  name: string;
  count: number;
}

/** Distinct sources present, each with its display name + set count, sorted by
 *  name (EXP-048 #2330). Drives the "Quelle" facet. */
export function availableSources(sets: SearchableSet[]): DiscoverSource[] {
  const byUrl = new Map<string, { name: string; count: number }>();
  for (const set of sets) {
    if (!set.repo_url) continue;
    const existing = byUrl.get(set.repo_url);
    if (existing) existing.count += 1;
    else byUrl.set(set.repo_url, { name: set.repo_name || set.repo_url, count: 1 });
  }
  return [...byUrl.entries()]
    .map(([url, v]) => ({ url, name: v.name, count: v.count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** True when the loaded catalogue carries at least one machine-origin set
 *  (``generated`` or ``reviewed``). Drives whether the "Durchsicht" facet is
 *  shown at all (EXP-048 #2321): with an all-``authored`` catalogue the facet
 *  would offer only dead options, so it stays hidden — data-driven, like the
 *  domain list. ``authored`` (incl. the absent-field default) never counts. */
export function hasReviewableSets(sets: SearchableSet[]): boolean {
  return sets.some(
    (set) =>
      set.review_status === "generated" || set.review_status === "reviewed",
  );
}

/** One computed way out of a zero-result state: clearing ``facet`` alone would
 *  leave ``count`` sets. */
export interface RelaxationHint {
  facet: string;
  count: number;
}

/** Facets offered as a computed escape from a zero-result state. The source
 *  language is deliberately excluded — it owns its own dedicated escape
 *  ("All languages", #1343) and stays the axis the learner reads in. */
const RELAXABLE_FACETS = [
  "query",
  "targetLanguage",
  "level",
  "domain",
  "trust",
  "reviewStatus",
  "source",
] as const;

/**
 * For each active relaxable facet, how many sets remain if ONLY that facet is
 * cleared (every other restriction kept). Returns those with a non-empty
 * result, most first — so a zero-result state can offer "Ohne {facet}: {n}
 * Sets", the #1343 source-language fallback generalised to every facet
 * (EXP-048 #2324). Never removes the source language.
 */
export function relaxationHints(
  sets: SearchableSet[],
  filters: DiscoverFilters,
  languageNames?: LanguageNameResolver,
): RelaxationHint[] {
  const hints: RelaxationHint[] = [];
  for (const facet of RELAXABLE_FACETS) {
    if (!filters[facet]) continue;
    const count = queryDiscoverSets(
      sets,
      { ...filters, [facet]: "" },
      "relevance",
      languageNames,
    ).length;
    if (count > 0) hints.push({ facet, count });
  }
  return hints.sort((a, b) => b.count - a.count);
}

/** Stable identity key for a discovered set (source + id). */
export function discoverSetKey(set: { repo_url: string; id: string }): string {
  return `${set.repo_url}::${set.id}`;
}
