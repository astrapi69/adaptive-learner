/**
 * Discover ("Inhalte entdecken") page — EXP-034 / DIS-05.
 *
 * Loads the lean search indices of every available content repo (official +
 * recommended + user repos) via the DIS-04 loader, then lets the learner FIND
 * material before downloading it: a debounced search field + combinable filters
 * (language / level / domain / trust / AI-checked) + sort, rendered as a list of
 * {@link SetDiscoveryCard}s. "Download" caches just that one set (it already
 * exists in the cache afterwards, so the Content Browser picks it up).
 *
 * Pure logic lives in ``lib/content/discover-index`` (filter/sort/match) and
 * ``lib/content/discover-repos`` (repo assembly); this component only wires
 * state + UI.
 */

import { Compass } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { ApiError } from "../../api/client";
import { useI18n } from "../../hooks/ui/useI18n";
import { isOfficialSource } from "../../lib/content/repos/content-repos";
import { dismissSet, undismissSet } from "../../lib/content/browse/dismissed-sets";
import { languageDisplayName } from "../../lib/content/language/language-names";
import {
  availableDomains,
  availableSources,
  availableSourceLanguages,
  availableTargetLanguages,
  availableLevels,
  discoverSetKey,
  EMPTY_FILTERS,
  hasReviewableSets,
  isSetDownloaded,
  queryDiscoverSets,
  relaxationHints,
  sourceLanguageCounts,
  targetLanguageCounts,
  type DiscoverFilters,
  type DiscoverSort,
} from "../../lib/content/repos/discover-index";
import { useDiscoverSourceLanguage } from "../../hooks/content/useDiscoverSourceLanguage";
import { useDiscoverEntry } from "../../hooks/content/useDiscoverEntry";
import { isKnowledgeDomain } from "../../lib/exercises/knowledge-domain";
import { collectDiscoveryRepos } from "../../lib/content/repos/discover-repos";
import {
  fetchAllIndices,
  type SearchableSet,
} from "../../lib/content/repos/search-index-loader";
import {
  markCatalogSeen,
  newKeysAgainstSeen,
} from "../../lib/content/browse/seen-catalog";
import InfoHint from "../../shared/feedback/InfoHint";
import PageContainer from "../../shared/layout/PageContainer";
import { type FilterDef } from "../../shared/forms/FilterBar";
import SearchFilterBar from "../../shared/forms/SearchFilterBar";
import FilterMenuButton from "../../shared/forms/FilterMenuButton";
import { Button } from "@/components/ui/button";
import ActiveFilterChips, {
  type FilterChip,
} from "../../shared/forms/ActiveFilterChips";
import SetDiscoveryCard, {
  type SetDiscoveryCardLabels,
  type SetDiscoveryDownloadState,
} from "../../shared/media/SetDiscoveryCard";
import DiscoverSetListView from "../../shared/media/DiscoverSetListView";
import ContentViewToggle from "../../components/content/browser/ContentViewToggle";
import { useContentViewMode } from "../../hooks/content/useContentViewMode";
import { getStorage } from "../../storage";
import { notify } from "../../utils/notify";

/** Debounce delay (ms) between a keystroke and the search re-running. */
const SEARCH_DEBOUNCE_MS = 300;

/** Render results in batches of this size, extended by "Show more" (EXP-048
 *  #2333) — never all at once, never infinite-scroll. The count above the list
 *  stays the FULL result count (the honest figure). */
const RESULT_BATCH_SIZE = 24;

/** Format the "DE → ES" language badge from a set's pair. */
function languageBadge(set: SearchableSet): string {
  const source = set.source_language ? set.source_language.toUpperCase() : "";
  const target = set.target_language ? set.target_language.toUpperCase() : "";
  if (source && target) return `${source} → ${target}`;
  return target || source;
}

export default function Discover() {
  const { t, lang } = useI18n();
  const [allSets, setAllSets] = useState<SearchableSet[]>([]);
  const [downloadedKeys, setDownloadedKeys] = useState<Set<string>>(new Set());
  // Keys of sets newly added to the catalogue since the user last saw it (#1337 f/u).
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
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
  const [downloadState, setDownloadState] = useState<
    Record<string, SetDiscoveryDownloadState>
  >({});
  const [downloadProgress, setDownloadProgress] = useState<
    Record<string, { current: number; total: number }>
  >({});
  // #1262 — grid (card) ⇄ list view, fed by the GLOBAL content-view
  // preference (#1257, default list) shared with "Meine Inhalte".
  const [viewMode, setViewMode] = useContentViewMode();

  // Debounce the search field into the active query filter.
  useEffect(() => {
    const id = setTimeout(
      () => setFilters((prev) => ({ ...prev, query: rawQuery })),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [rawQuery]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const repos = await collectDiscoveryRepos();
        const local = await getStorage()
          .contentLoader.listSets()
          .catch(() => ({ sets: [], sources: [] }));
        const applySets = (sets: SearchableSet[]) => {
          if (cancelled) return;
          setAllSets(sets);
          const keys = new Set<string>();
          for (const set of sets) {
            if (isSetDownloaded(set, local.sets)) keys.add(discoverSetKey(set));
          }
          setDownloadedKeys(keys);
        };
        // 1) Instant paint from the TTL cache (stale-while-revalidate).
        applySets(await fetchAllIndices(repos));
        if (cancelled) return;
        setLoading(false);
        // 2) Always force-refresh the catalogue from the live repo so a
        //    newly-published set (e.g. the first set in a new source
        //    language) appears on reopen without waiting out the 24h TTL,
        //    and after a content sync. A failed refresh keeps the cached
        //    list (#1337).
        const fresh = await fetchAllIndices(repos, { forceRefresh: true });
        applySets(fresh);
        if (cancelled) return;
        // New-content indicator: flag sets not in the last-seen anchor, then
        // update the anchor so they are no longer "New" next time (#1337 f/u).
        const freshKeys = fresh.map(discoverSetKey);
        setNewKeys(newKeysAgainstSeen(freshKeys));
        markCatalogSeen(freshKeys);
      } catch (err) {
        if (!cancelled) {
          notify.error(
            t("discover.error.load_failed", "Could not load available content."),
            { apiError: err instanceof ApiError ? err : undefined },
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // Run once on mount; t/lang only affect labels which re-render anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // #772 — once the learner has downloaded a set this session, point them
  // back to the Content Browser ("Meine Inhalte"), where it now lives.
  const hasDownloaded = useMemo(
    () => Object.values(downloadState).some((state) => state === "done"),
    [downloadState],
  );

  // Source-language facet (#1343 / #1699): the instruction languages actually
  // present, each with its set count, plus an explicit "All languages".
  // Rendered as an ALWAYS-VISIBLE chip (below) — never hidden behind the
  // collapsible filter panel, so the learner always sees THAT the list is
  // filtered and WHAT to (never silently). Reuses the FilterMenuButton pattern
  // the Content Browser uses for its Status/Source filters.
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
          label: `${languageDisplayName(code, lang)} (${counts[code] ?? 0})`,
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
        label: `${languageDisplayName(code, lang)} (${counts[code] ?? 0})`,
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

  function handleFilterChange(id: string, value: string) {
    if (id === "sort") {
      setSort(value as DiscoverSort);
      return;
    }
    setFilters((prev) => ({ ...prev, [id]: value }));
  }

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
        onRemove: () => {
          setRawQuery("");
          setFilters((prev) => ({ ...prev, query: "" }));
        },
      });
    }
    if (filters.level) {
      chips.push({
        id: "level",
        label: `${t("discover.filter.level", "Level")}: ${filters.level.toUpperCase()}`,
        onRemove: () => setFilters((prev) => ({ ...prev, level: "" })),
      });
    }
    if (filters.domain) {
      chips.push({
        id: "domain",
        label: `${t("discover.filter.domain", "Domain")}: ${t(`discover.domain.${filters.domain}`, filters.domain)}`,
        onRemove: () => setFilters((prev) => ({ ...prev, domain: "" })),
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
        onRemove: () => setFilters((prev) => ({ ...prev, trust: "" })),
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
        onRemove: () => setFilters((prev) => ({ ...prev, reviewStatus: "" })),
      });
    }
    if (filters.source) {
      chips.push({
        id: "source",
        label: `${t("discover.filter.source", "Source")}: ${sourceNameByUrl[filters.source] ?? filters.source}`,
        onRemove: () => setFilters((prev) => ({ ...prev, source: "" })),
      });
    }
    return chips;
  }, [filters, t, sourceNameByUrl]);

  // Clear every ADDED filter (query, target, level, domain, trust, review) in
  // one action, keeping the source language — the axis the learner reads in
  // (EXP-048 #2324). The source has its own "All languages" escape (#1343).
  const resetAllFilters = () => {
    setRawQuery("");
    setFilters(EMPTY_FILTERS);
  };

  const clearFacet = (facet: string) => {
    if (facet === "query") {
      setRawQuery("");
      setFilters((prev) => ({ ...prev, query: "" }));
      return;
    }
    setFilters((prev) => ({ ...prev, [facet]: "" }));
  };

  const facetLabel = (facet: string): string => {
    switch (facet) {
      case "query":
        return t("discover.bar.search", "Search");
      case "targetLanguage":
        return t("discover.filter.target_language", "Target language");
      case "level":
        return t("discover.filter.level", "Level");
      case "domain":
        return t("discover.filter.domain", "Domain");
      case "trust":
        return t("discover.filter.trust", "Trust");
      case "reviewStatus":
        return t("discover.filter.review", "Review");
      case "source":
        return t("discover.filter.source", "Source");
      default:
        return facet;
    }
  };

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
  const hasAddedFilter =
    activeChips.length > 0 || filters.targetLanguage !== "";

  async function handleDownload(set: SearchableSet) {
    const key = discoverSetKey(set);
    setDownloadState((prev) => ({ ...prev, [key]: "downloading" }));
    setDownloadProgress((prev) => ({ ...prev, [key]: { current: 0, total: set.lesson_count } }));
    try {
      await getStorage().contentLoader.downloadSet(set.repo_url, set.id, (progress) =>
        setDownloadProgress((prev) => ({ ...prev, [key]: progress })),
      );
      // #1709 — an explicit (re-)download revives a previously deleted set in
      // "Meine Inhalte"; clear any stale dismissal record.
      undismissSet(set.repo_url, set.id);
      setDownloadState((prev) => ({ ...prev, [key]: "done" }));
      setDownloadedKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      notify.success(t("discover.toast.downloaded", "Set downloaded and ready to use."));
    } catch (err) {
      setDownloadState((prev) => ({ ...prev, [key]: "error" }));
      notify.error(t("discover.error.download_failed", "Could not download the set."), {
        apiError: err instanceof ApiError ? err : undefined,
      });
    }
  }

  async function handleRemove(set: SearchableSet) {
    const key = discoverSetKey(set);
    try {
      await getStorage().contentLoader.deleteSet(set.repo_url, set.id);
      // #1709 — removing the download here is just as explicit as deleting in
      // "Meine Inhalte": remember it so a Refresh does not restore the set
      // there. Discover itself keeps listing the set (download it anytime).
      dismissSet(set.repo_url, set.id);
      setDownloadedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setDownloadState((prev) => ({ ...prev, [key]: "idle" }));
      notify.success(t("discover.toast.removed", "Set removed. You can download it again anytime."));
    } catch (err) {
      notify.error(t("discover.error.remove_failed", "Could not remove the set."), {
        apiError: err instanceof ApiError ? err : undefined,
      });
    }
  }

  const cardLabels: SetDiscoveryCardLabels = {
    download: t("discover.card.download", "Download"),
    downloading: t("discover.card.downloading", "Downloading…"),
    retry: t("discover.card.retry", "Retry"),
    downloaded: t("discover.card.downloaded", "Already present"),
    lessons: "",
    cards: "",
    aiChecked: t("discover.card.ai_checked", "AI-checked"),
    trust: "",
    remove: t("discover.card.remove", "Remove"),
    progress: t("discover.card.progress", "Downloading lessons"),
    reviewGenerated: t("discover.review.generated_badge", "Machine-made"),
    reviewReviewed: t("discover.review.reviewed_badge", "Reviewed"),
  };

  const newBadgeLabel = t("discover.badge.new", "New");

  function trustLabel(level: number): string {
    if (level >= 3) return t("discover.trust.official", "Officially recommended");
    if (level >= 2) return t("discover.trust.verified", "Verified");
    if (level >= 1) return t("discover.trust.validated", "Validated");
    return "";
  }

  if (loading) {
    return (
      <PageContainer testId="discover-loading">
        <p>{t("discover.loading", "Loading available content…")}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer testId="discover-page">
      <header className="mb-4 flex items-center gap-2">
        <Compass className="size-6 text-accent" aria-hidden="true" />
        <h1 className="text-xl font-semibold">{t("discover.title", "Discover content")}</h1>
        {/* #1251 — the permanent subtitle is replaced by an info button that
            expands the explanation inline on demand (blinks gently for a
            first-time visitor, then bows out). */}
        <InfoHint
          storageId="content_discover"
          text={t("discover.subtitle", "Find learning material before you download it.")}
          label={t("ui.info.show", "Show information")}
          className="mb-0"
          testId="discover-info"
        />
      </header>

      {hasDownloaded && (
        <p
          className="mb-3 text-sm text-muted-foreground"
          data-testid="discover-to-content"
        >
          <Link to="/content?tab=my" className="text-accent hover:underline">
            {t("discover.to_content", "Go to Content Browser")} →
          </Link>
        </p>
      )}

      <SearchFilterBar
        searchValue={rawQuery}
        onSearchChange={setRawQuery}
        searchPlaceholder={t("discover.search_placeholder", "Spanisch, KI, Psychologie…")}
        searchAriaLabel={t("discover.search_aria", "Search available content")}
        searchClearLabel={t("discover.search_clear", "Clear search")}
        searchTestId="discover-search"
        filters={filterDefs}
        onFilterChange={handleFilterChange}
        filtersTestId="discover-filters"
        searchButtonLabel={t("discover.bar.search", "Search")}
        filterButtonLabel={t("discover.bar.filter", "Filter")}
        className="mb-3"
        testId="discover-search-filter"
      />

      {/* #1699 — the source-language filter is ALWAYS visible (never hidden
          behind the collapsible panel), so the learner always sees that the
          list is filtered and can change it in one tap. Default = UI locale;
          an explicit choice persists and wins over the default (#1343). */}
      <div
        className="mb-4 flex flex-wrap items-center gap-2"
        data-testid="discover-language-filter-row"
      >
        {/* #2331 — the entry point (Sprache lernen / Fachgebiet / Alles) is the
            primary axis and the first always-visible control: it presets WHICH
            second axis (target+level vs. domain) the learner refines by. */}
        <FilterMenuButton
          label={t("discover.entry.label", "I want to")}
          options={entryOptions}
          value={effectiveEntry}
          onChange={handleEntryChange}
          testId="discover-entry-filter"
        />
        <FilterMenuButton
          label={t("discover.filter.language", "Language")}
          options={languageOptions}
          value={effectiveSourceLanguage}
          onChange={setLangChoice}
          testId="discover-language-filter"
        />
        {/* #2322 — the target (learned) language is the second axis of a
            language search, and just as always-visible as the source. Shown
            once the current source offers more than one target. */}
        {showTargetFacet && (
          <FilterMenuButton
            label={t("discover.filter.target_language", "Target language")}
            options={targetLanguageOptions}
            value={filters.targetLanguage}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, targetLanguage: value }))
            }
            testId="discover-target-filter"
          />
        )}
      </div>

      {/* #2323 — every other active restriction as a removable mark, on one
          horizontally-scrollable line (the phone's single visible filter
          surface). Absent when nothing beyond the source default is set. */}
      {activeChips.length > 0 && (
        <div className="mb-4">
          <ActiveFilterChips
            chips={activeChips}
            removeLabel={(label) =>
              t("discover.chips.remove", "Remove {f}").replace("{f}", label)
            }
            onClearAll={hasAddedFilter ? resetAllFilters : undefined}
            clearAllLabel={t("discover.empty.reset_all", "Reset all filters")}
            testId="discover-active-filters"
          />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" data-testid="discover-count">
          {t("discover.result.count", "{n} sets").replace("{n}", String(results.length))}
          {newKeys.size > 0 && (
            <span className="ml-2 text-accent" data-testid="discover-new-count">
              {t("discover.new.count", "{n} new").replace("{n}", String(newKeys.size))}
            </span>
          )}
        </p>
        {/* #1262 — grid/list toggle, sharing the global view preference.
            Shown once there is content to view. */}
        {allSets.length > 0 && (
          <ContentViewToggle mode={viewMode} onChange={setViewMode} />
        )}
      </div>

      {allSets.length === 0 ? (
        <div className="text-muted-foreground" data-testid="discover-empty-none">
          <p>{t("discover.empty.no_sets", "No content available yet.")}</p>
          {/* The library genuinely has nothing: this is its own statement, not
              a filter problem — point at adding a source or writing a lesson
              (EXP-048 #2324). */}
          <p className="mt-2" data-testid="discover-empty-add-source">
            <Link to="/add-repo" className="text-accent hover:underline">
              {t("discover.empty.add_source", "Add your own source")}
            </Link>{" "}
            {t("discover.empty.or", "or")}{" "}
            <Link to="/create-lesson" className="text-accent hover:underline">
              {t("discover.empty.create_lesson", "create a lesson")}
            </Link>
            .
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-muted-foreground" data-testid="discover-empty-results">
          <p>
            {t("discover.empty.no_results", "No results for “{query}”.").replace(
              "{query}",
              filters.query,
            )}
          </p>
          {/* Never a dead end: when a source-language filter is active, offer a
              one-tap escape to "All languages" (#1343). */}
          {effectiveSourceLanguage !== "" && (
            <p className="mt-2" data-testid="discover-empty-language">
              {t(
                "discover.empty.language_hint",
                "Nothing in this language yet.",
              )}{" "}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => setLangChoice("")}
                data-testid="discover-show-all-languages"
              >
                {t("discover.filter.all_languages", "All languages")}
              </button>
            </p>
          )}
          {/* Computed, per-facet exits: "Without {facet}: {n} sets" — the
              source-language fallback generalised to every facet (#2324). */}
          {relaxHints.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1" data-testid="discover-empty-hints">
              {relaxHints.map((hint) => (
                <li key={hint.facet}>
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => clearFacet(hint.facet)}
                    data-testid={`discover-empty-hint-${hint.facet}`}
                  >
                    {t("discover.empty.without_facet", "Without {facet}: {n} sets")
                      .replace("{facet}", facetLabel(hint.facet))
                      .replace("{n}", String(hint.count))}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {/* One action to clear every added restriction (#2324). */}
          {hasAddedFilter && (
            <p className="mt-2">
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={resetAllFilters}
                data-testid="discover-empty-reset"
              >
                {t("discover.empty.reset_all", "Reset all filters")}
              </button>
            </p>
          )}
        </div>
      ) : viewMode === "list" ? (
        <DiscoverSetListView
          sets={visibleResults}
          keyFor={discoverSetKey}
          isDownloaded={(set) => downloadedKeys.has(discoverSetKey(set))}
          stateFor={(set) => downloadState[discoverSetKey(set)] ?? "idle"}
          canRemove={(set) => !isOfficialSource(set.repo_url)}
          isNew={(set) => newKeys.has(discoverSetKey(set))}
          onDownload={handleDownload}
          onRemove={handleRemove}
          labels={{
            download: cardLabels.download,
            downloading: cardLabels.downloading,
            retry: cardLabels.retry,
            downloaded: cardLabels.downloaded,
            remove: cardLabels.remove,
            lessons: (count) =>
              t("discover.card.lessons", "{n} lessons").replace("{n}", String(count)),
            newBadge: newBadgeLabel,
            reviewGenerated: cardLabels.reviewGenerated,
            reviewReviewed: cardLabels.reviewReviewed,
          }}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="discover-results">
          {visibleResults.map((set) => {
            const key = discoverSetKey(set);
            return (
              <li key={key}>
                <SetDiscoveryCard
                  set={set}
                  isDownloaded={downloadedKeys.has(key)}
                  state={downloadState[key] ?? "idle"}
                  progress={downloadProgress[key]}
                  isNew={newKeys.has(key)}
                  newLabel={newBadgeLabel}
                  onDownload={handleDownload}
                  onRemove={isOfficialSource(set.repo_url) ? undefined : handleRemove}
                  languageLabel={languageBadge(set)}
                  labels={{
                    ...cardLabels,
                    lessons: t("discover.card.lessons", "{n} lessons").replace(
                      "{n}",
                      String(set.lesson_count),
                    ),
                    cards: t("discover.card.cards", "{n} cards").replace(
                      "{n}",
                      String(set.card_count),
                    ),
                    trust: trustLabel(set.trust_level),
                  }}
                  testId={`discover-card-${set.id}`}
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* #2333 — extend the list one batch at a time; the count above the list
          stays the full number. No infinite scroll (keeps the back-path and the
          honest result size), no hard cap. */}
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setVisibleCount((count) => count + RESULT_BATCH_SIZE)}
            data-testid="discover-show-more"
          >
            {t("discover.result.show_more", "Show more")}
          </Button>
        </div>
      )}
    </PageContainer>
  );
}
