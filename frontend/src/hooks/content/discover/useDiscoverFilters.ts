/**
 * useDiscoverFilters, split out of the Discover page (#3271).
 *
 * Owns the Discover query state: the debounced search field, the facet
 * filters + sort, the two persisted axes (source language #1343, entry point
 * #2331) with their defaults, the resulting filtered + sorted list, its
 * batch-wise rendering (EXP-048 #2333), and the computed exits of a
 * zero-result state (#2324). The option lists the controls render live in
 * {@link useDiscoverFacets}.
 *
 * @example
 * const query = useDiscoverFilters(allSets);
 * query.handleFilterChange("level", "a1");
 * query.visibleResults; // the first batch of the matching sets
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { languageDisplayName } from "../../../lib/content/language/language-names";
import {
  EMPTY_FILTERS,
  queryDiscoverSets,
  relaxationHints,
  type DiscoverFilters,
  type DiscoverLanguagePair,
  type DiscoverSort,
} from "../../../lib/content/repos/discover-index";
import type { SearchableSet } from "../../../lib/content/repos/search-index-loader";
import { useI18n } from "../../ui/useI18n";
import { useDiscoverEntry } from "./useDiscoverEntry";
import { useDiscoverSourceLanguage } from "./useDiscoverSourceLanguage";

/** Debounce delay (ms) between a keystroke and the search re-running. */
const SEARCH_DEBOUNCE_MS = 300;

/** Render results in batches of this size, extended by "Show more" (EXP-048
 *  #2333) — never all at once, never infinite-scroll. The count above the list
 *  stays the FULL result count (the honest figure). */
const RESULT_BATCH_SIZE = 24;

/** Discover filter state, derived results and the handlers that change them. */
export function useDiscoverFilters(allSets: SearchableSet[]) {
  const { lang } = useI18n();
  const [rawQuery, setRawQuery] = useState("");
  const [filters, setFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<DiscoverSort>("relevance");
  // Source-language filter (#1343). The stored value is the EXPLICIT choice,
  // or null when unset — in which case the default follows the UI locale
  // (and moves when the learner switches UI language). An explicit choice
  // ("" = all languages) always wins over the locale default.
  const [langChoice, setLangChoice] = useDiscoverSourceLanguage();
  // #2331 — entry-point preset (Sprache lernen / Fachgebiet / Alles). Explicit
  // choice persists; unset defaults to "language" (the vorbelegter Einstieg).
  const [entryChoice, setEntryChoice] = useDiscoverEntry();

  // Debounce the search field into the active query filter.
  useEffect(() => {
    const id = setTimeout(
      () => setFilters((prev) => ({ ...prev, query: rawQuery })),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [rawQuery]);

  // The instruction language the list is filtered to: the explicit choice
  // when set, else the UI-locale default (base subtag, e.g. "de-AT" → "de").
  const localeDefaultLanguage = useMemo(
    () => (lang || "").split("-")[0],
    [lang],
  );
  const effectiveSourceLanguage =
    langChoice ?? localeDefaultLanguage;

  const effectiveEntry = entryChoice ?? "language";

  const activeFilters = useMemo<DiscoverFilters>(
    () => ({
      ...filters,
      sourceLanguage: effectiveSourceLanguage,
      entry: effectiveEntry,
    }),
    [filters, effectiveSourceLanguage, effectiveEntry],
  );

  // #2329 — resolve a BCP-47 code to its name in the active UI language, so a
  // learner can search "Spanish"/"Spanisch" and find a set whose visible name
  // is written in the other language.
  const resolveLanguageName = useMemo(
    () => (code: string) => languageDisplayName(code, lang),
    [lang],
  );

  const results = useMemo(
    () => queryDiscoverSets(allSets, activeFilters, sort, resolveLanguageName),
    [allSets, activeFilters, sort, resolveLanguageName],
  );

  // #2333 — schubweises Rendern. Render the first batch and extend on demand;
  // a filter/query/sort change starts over from the first batch (a background
  // catalogue refresh does NOT, so it never yanks the reader back up).
  const [visibleCount, setVisibleCount] = useState(RESULT_BATCH_SIZE);
  useEffect(() => {
    setVisibleCount(RESULT_BATCH_SIZE);
  }, [activeFilters, sort]);
  const visibleResults = useMemo(
    () => results.slice(0, visibleCount),
    [results, visibleCount],
  );
  const hasMore = results.length > visibleResults.length;
  const showMore = () => setVisibleCount((count) => count + RESULT_BATCH_SIZE);

  // Switching the entry clears the facets the new entry hides, so a stale
  // hidden restriction can never silently zero the list.
  function handleEntryChange(value: string) {
    setEntryChoice(value);
    if (value === "language") {
      setFilters((prev) => ({ ...prev, domain: "" }));
    } else if (value === "knowledge") {
      setFilters((prev) => ({ ...prev, level: "", targetLanguage: "" }));
    }
  }

  // Language-pair matrix (#2337): an alternative entry that sets BOTH language
  // axes at once. Computed over the WHOLE catalogue (not the source-scoped
  // slice), so it also surfaces pairs in other instruction languages — that is
  // the jump it offers. Shown in the language / "Alles" entry once more than one
  // pair is populated (a single pair is no choice). Schwelle bewusst
  // überschritten: gebaut unter der ~200-Sets-Schwelle auf Nutzer-Entscheidung.
  // Selecting a pair presets the language entry + both language axes at once.
  // Clearing the hidden domain restriction mirrors handleEntryChange, so a
  // stale knowledge-domain filter can never silently zero the jumped-to list.
  function handlePairSelect(pair: DiscoverLanguagePair) {
    setEntryChoice("language");
    setLangChoice(pair.source);
    setFilters((prev) => ({ ...prev, targetLanguage: pair.target, domain: "" }));
  }

  function handleFilterChange(id: string, value: string) {
    if (id === "sort") {
      setSort(value as DiscoverSort);
      return;
    }
    setFilters((prev) => ({ ...prev, [id]: value }));
  }

  const setTargetLanguage = (value: string) =>
    setFilters((prev) => ({ ...prev, targetLanguage: value }));

  // Clear every ADDED filter (query, target, level, domain, trust, review) in
  // one action, keeping the source language — the axis the learner reads in
  // (EXP-048 #2324). The source has its own "All languages" escape (#1343).
  const resetAllFilters = () => {
    setRawQuery("");
    setFilters(EMPTY_FILTERS);
  };

  /** Clear one facet; the query also empties the (not yet debounced) field. */
  const clearFacet = useCallback((facet: string) => {
    if (facet === "query") {
      setRawQuery("");
      setFilters((prev) => ({ ...prev, query: "" }));
      return;
    }
    setFilters((prev) => ({ ...prev, [facet]: "" }));
  }, []);

  // Computed exits for a zero-result state: for each active facet, how many
  // sets would remain if only it were cleared (EXP-048 #2324). Only when the
  // list is actually empty.
  const relaxHints = useMemo(
    () =>
      results.length === 0
        ? relaxationHints(allSets, activeFilters, resolveLanguageName)
        : [],
    [results.length, allSets, activeFilters, resolveLanguageName],
  );

  return {
    rawQuery,
    setRawQuery,
    filters,
    sort,
    setLangChoice,
    effectiveSourceLanguage,
    effectiveEntry,
    results,
    visibleResults,
    hasMore,
    showMore,
    handleEntryChange,
    handlePairSelect,
    handleFilterChange,
    setTargetLanguage,
    resetAllFilters,
    clearFacet,
    relaxHints,
  };
}
