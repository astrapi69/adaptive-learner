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
import { Link } from "react-router-dom";

import { ApiError } from "../../api/client";
import { useI18n } from "../../hooks/ui/useI18n";
import { isOfficialSource } from "../../lib/content/repos/content-repos";
import { languageDisplayName } from "../../lib/content/language/language-names";
import {
  availableDomains,
  availableSourceLanguages,
  availableLevels,
  discoverSetKey,
  EMPTY_FILTERS,
  isSetDownloaded,
  queryDiscoverSets,
  sourceLanguageCounts,
  type DiscoverFilters,
  type DiscoverSort,
} from "../../lib/content/repos/discover-index";
import { useDiscoverSourceLanguage } from "../../hooks/content/useDiscoverSourceLanguage";
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

  const activeFilters = useMemo<DiscoverFilters>(
    () => ({ ...filters, sourceLanguage: effectiveSourceLanguage }),
    [filters, effectiveSourceLanguage],
  );

  const results = useMemo(
    () => queryDiscoverSets(allSets, activeFilters, sort),
    [allSets, activeFilters, sort],
  );

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
    return [
      { id: "level", label: t("discover.filter.level", "Level"), value: filters.level, options: [all, ...levels] },
      { id: "domain", label: t("discover.filter.domain", "Domain"), value: filters.domain, options: [all, ...domains] },
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
      {
        id: "aiChecked",
        label: t("discover.filter.ai_checked", "AI-checked"),
        value: filters.aiChecked,
        options: [
          all,
          { value: "yes", label: t("common.yes", "Yes") },
          { value: "no", label: t("common.no", "No") },
        ],
      },
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
  }, [allSets, filters, sort, t]);

  function handleFilterChange(id: string, value: string) {
    if (id === "sort") {
      setSort(value as DiscoverSort);
      return;
    }
    setFilters((prev) => ({ ...prev, [id]: value }));
  }

  async function handleDownload(set: SearchableSet) {
    const key = discoverSetKey(set);
    setDownloadState((prev) => ({ ...prev, [key]: "downloading" }));
    setDownloadProgress((prev) => ({ ...prev, [key]: { current: 0, total: set.lesson_count } }));
    try {
      await getStorage().contentLoader.downloadSet(set.repo_url, set.id, (progress) =>
        setDownloadProgress((prev) => ({ ...prev, [key]: progress })),
      );
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
        <FilterMenuButton
          label={t("discover.filter.language", "Language")}
          options={languageOptions}
          value={effectiveSourceLanguage}
          onChange={setLangChoice}
          testId="discover-language-filter"
        />
      </div>

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
        <p className="text-muted-foreground" data-testid="discover-empty-none">
          {t("discover.empty.no_sets", "No content available yet.")}
        </p>
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
        </div>
      ) : viewMode === "list" ? (
        <DiscoverSetListView
          sets={results}
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
          }}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="discover-results">
          {results.map((set) => {
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
    </PageContainer>
  );
}
