/**
 * useDiscoverFacets, split out of the Discover page (#3271).
 *
 * Derives every option list the Discover controls render from the loaded
 * catalogue and the current filter state: the entry-point presets with their
 * counts (#2331), the source-language (#1343 / #1699) and target-language
 * (#2322) axes, the collapsible facet panel (level, domain, trust, review,
 * source, sort) and the removable chips of every active restriction (EXP-048
 * #2323). Data-driven throughout, so no control offers a dead option.
 *
 * @example
 * const facets = useDiscoverFacets({
 *   allSets, filters, sort, effectiveSourceLanguage, effectiveEntry, clearFacet,
 * });
 * <SearchFilterBar filters={facets.filterDefs} ... />
 */

import { useMemo } from "react";

import { flaggedName } from "../../../lib/content/language/language-names";
import {
  availableDomains,
  availableLevels,
  availableSourceLanguages,
  availableSources,
  availableTargetLanguages,
  hasReviewableSets,
  sourceLanguageCounts,
  targetLanguageCounts,
  type DiscoverFilters,
  type DiscoverSort,
} from "../../../lib/content/repos/discover-index";
import type { SearchableSet } from "../../../lib/content/repos/search-index-loader";
import { isKnowledgeDomain } from "../../../lib/exercises/knowledge-domain";
import type { FilterChip } from "../../../shared/forms/ActiveFilterChips";
import type { FilterDef } from "../../../shared/forms/FilterBar";
import { useI18n } from "../../ui/useI18n";

interface UseDiscoverFacetsDeps {
  allSets: SearchableSet[];
  filters: DiscoverFilters;
  sort: DiscoverSort;
  effectiveSourceLanguage: string;
  effectiveEntry: string;
  /** Clear one facet; backs every chip's remove action. */
  clearFacet: (facet: string) => void;
}

/** Option lists, facet definitions and active-filter chips for Discover. */
export function useDiscoverFacets({
  allSets,
  filters,
  sort,
  effectiveSourceLanguage,
  effectiveEntry,
  clearFacet,
}: UseDiscoverFacetsDeps) {
  const { t, lang } = useI18n();

  // Source-language facet (#1343 / #1699): the instruction languages actually
  // present, each with its set count, plus an explicit "All languages".
  // Rendered as an ALWAYS-VISIBLE chip — never hidden behind the collapsible
  // filter panel, so the learner always sees THAT the list is filtered and
  // WHAT to (never silently). Reuses the FilterMenuButton pattern the Content
  // Browser uses for its Status/Source filters.
  const languageOptions = useMemo(
    () => {
      const counts = sourceLanguageCounts(allSets);
      return [
        {
          value: "",
          label: t("discover.filter.all_languages", "All languages"),
        },
        ...availableSourceLanguages(allSets).map((code) => ({
          value: code,
          label: `${flaggedName(code, lang)} (${counts[code] ?? 0})`,
        })),
      ];
    },
    [allSets, t, lang],
  );

  // The "Durchsicht" (review-standing) facet is data-driven: only shown while
  // the loaded catalogue actually carries a machine-origin set (generated /
  // reviewed), so the bar never grows a dead option (EXP-048 #2321).
  const showReviewFacet = useMemo(() => hasReviewableSets(allSets), [allSets]);

  // Target-language facet (#2322): the SECOND axis a language learner searches
  // by. Its options are scoped to the active SOURCE language (a de learner is
  // offered the targets that exist for de), so the count on each mark is honest
  // for the current view, and sorted by that count (most material first).
  const sourceScopedSets = useMemo(
    () =>
      allSets.filter(
        (set) =>
          !effectiveSourceLanguage ||
          set.source_language === effectiveSourceLanguage,
      ),
    [allSets, effectiveSourceLanguage],
  );
  const targetLanguageOptions = useMemo(() => {
    const counts = targetLanguageCounts(sourceScopedSets);
    const codes = availableTargetLanguages(sourceScopedSets).sort(
      (a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b),
    );
    return [
      {
        value: "",
        label: t("discover.filter.all_target_languages", "All target languages"),
      },
      ...codes.map((code) => ({
        value: code,
        label: `${flaggedName(code, lang)} (${counts[code] ?? 0})`,
      })),
    ];
  }, [sourceScopedSets, t, lang]);
  // Target + level only carry meaning in the "language" task; the domain facet
  // only in the "knowledge" task (EXP-048 #2331). In the "Alles" entry all show.
  const showTargetFacet =
    effectiveEntry !== "knowledge" && targetLanguageOptions.length > 1;

  // Entry-point control (#2331): three presets over the SAME list, each with
  // its count in the current source language, so an empty entry shows its zero
  // instead of leading into nothing.
  const entryCounts = useMemo(() => {
    let language = 0;
    let knowledge = 0;
    for (const set of sourceScopedSets) {
      if (isKnowledgeDomain(set.domain, set.source_language, set.target_language)) {
        knowledge += 1;
      } else {
        language += 1;
      }
    }
    return { language, knowledge, all: sourceScopedSets.length };
  }, [sourceScopedSets]);
  const entryOptions = useMemo(
    () => [
      {
        value: "language",
        label: `${t("discover.entry.language", "Learn a language")} (${entryCounts.language})`,
      },
      {
        value: "knowledge",
        label: `${t("discover.entry.knowledge", "Subject")} (${entryCounts.knowledge})`,
      },
      {
        value: "",
        label: `${t("discover.entry.all", "Everything")} (${entryCounts.all})`,
      },
    ],
    [entryCounts, t],
  );

  // Source (repo) facet (#2330): Discover searches every validated + own repo
  // regardless of the Settings source management; this facet makes that
  // transparent. Data-driven; shown once more than one source is present.
  const sources = useMemo(() => availableSources(allSets), [allSets]);
  const sourceNameByUrl = useMemo(() => {
    const map: Record<string, string> = {};
    for (const source of sources) map[source.url] = source.name;
    return map;
  }, [sources]);

  const filterDefs: FilterDef[] = useMemo(() => {
    const all = { value: "", label: t("discover.filter.all", "All") };
    const levels = availableLevels(allSets).map((level) => ({
      value: level,
      label: level.toUpperCase(),
    }));
    const domains = availableDomains(allSets).map((domain) => ({
      value: domain,
      label: t(`discover.domain.${domain}`, domain),
    }));
    const sourceFacet: FilterDef[] =
      sources.length > 1
        ? [
            {
              id: "source",
              label: t("discover.filter.source", "Source"),
              value: filters.source,
              options: [
                all,
                ...sources.map((source) => ({
                  value: source.url,
                  label: `${source.name} (${source.count})`,
                })),
              ],
            },
          ]
        : [];
    const reviewFacet: FilterDef[] = showReviewFacet
      ? [
          {
            id: "reviewStatus",
            label: t("discover.filter.review", "Review"),
            value: filters.reviewStatus,
            options: [
              all,
              { value: "authored", label: t("discover.review.no_machine", "No machine sets") },
              { value: "reviewed", label: t("discover.review.reviewed_only", "Reviewed only") },
            ],
          },
        ]
      : [];
    // Niveau only in the language task (Freitext / absent for knowledge sets),
    // Bereich only in the knowledge task (all one value under "language") -
    // EXP-048 #2331. In "Alles" both show.
    const levelFacet: FilterDef[] =
      effectiveEntry !== "knowledge"
        ? [{ id: "level", label: t("discover.filter.level", "Level"), value: filters.level, options: [all, ...levels] }]
        : [];
    const domainFacet: FilterDef[] =
      effectiveEntry !== "language"
        ? [{ id: "domain", label: t("discover.filter.domain", "Domain"), value: filters.domain, options: [all, ...domains] }]
        : [];
    return [
      ...levelFacet,
      ...domainFacet,
      {
        id: "trust",
        label: t("discover.filter.trust", "Trust"),
        value: filters.trust,
        options: [
          all,
          { value: "3", label: t("discover.trust.official", "Officially recommended") },
          { value: "2", label: t("discover.trust.verified", "Verified") },
          { value: "1", label: t("discover.trust.validated", "Validated") },
        ],
      },
      ...reviewFacet,
      ...sourceFacet,
      {
        id: "sort",
        label: t("discover.sort.label", "Sort"),
        value: sort,
        options: [
          { value: "relevance", label: t("discover.sort.relevance", "Relevance") },
          { value: "newest", label: t("discover.sort.newest", "Newest") },
          { value: "lessons", label: t("discover.sort.lessons", "Most lessons") },
        ],
      },
    ];
  }, [allSets, filters, sort, t, showReviewFacet, sources, effectiveEntry]);

  // Every active restriction OTHER than the source language (which is its own
  // always-visible control, #1699) as a removable mark (EXP-048 #2323), so a
  // collapsed filter panel never hides what is filtering the list. The target
  // language keeps its own always-visible facet, so it is not duplicated here.
  const activeChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (filters.query) {
      chips.push({
        id: "query",
        label: `${t("discover.bar.search", "Search")}: ${filters.query}`,
        onRemove: () => clearFacet("query"),
      });
    }
    if (filters.level) {
      chips.push({
        id: "level",
        label: `${t("discover.filter.level", "Level")}: ${filters.level.toUpperCase()}`,
        onRemove: () => clearFacet("level"),
      });
    }
    if (filters.domain) {
      chips.push({
        id: "domain",
        label: `${t("discover.filter.domain", "Domain")}: ${t(`discover.domain.${filters.domain}`, filters.domain)}`,
        onRemove: () => clearFacet("domain"),
      });
    }
    if (filters.trust) {
      const trustText =
        filters.trust === "3"
          ? t("discover.trust.official", "Officially recommended")
          : filters.trust === "2"
            ? t("discover.trust.verified", "Verified")
            : t("discover.trust.validated", "Validated");
      chips.push({
        id: "trust",
        label: `${t("discover.filter.trust", "Trust")}: ${trustText}`,
        onRemove: () => clearFacet("trust"),
      });
    }
    if (filters.reviewStatus) {
      const reviewText =
        filters.reviewStatus === "reviewed"
          ? t("discover.review.reviewed_only", "Reviewed only")
          : t("discover.review.no_machine", "No machine sets");
      chips.push({
        id: "reviewStatus",
        label: `${t("discover.filter.review", "Review")}: ${reviewText}`,
        onRemove: () => clearFacet("reviewStatus"),
      });
    }
    if (filters.source) {
      chips.push({
        id: "source",
        label: `${t("discover.filter.source", "Source")}: ${sourceNameByUrl[filters.source] ?? filters.source}`,
        onRemove: () => clearFacet("source"),
      });
    }
    return chips;
  }, [filters, t, sourceNameByUrl, clearFacet]);

  const hasAddedFilter =
    activeChips.length > 0 || filters.targetLanguage !== "";

  return {
    languageOptions,
    targetLanguageOptions,
    showTargetFacet,
    entryOptions,
    filterDefs,
    activeChips,
    hasAddedFilter,
  };
}
