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
import { isOfficialSource } from "../../lib/content/content-repos";
import { languageDisplayName } from "../../lib/content/language-names";
import {
  availableDomains,
  availableLanguages,
  availableLevels,
  discoverSetKey,
  EMPTY_FILTERS,
  isSetDownloaded,
  queryDiscoverSets,
  type DiscoverFilters,
  type DiscoverSort,
} from "../../lib/content/discover-index";
import { collectDiscoveryRepos } from "../../lib/content/discover-repos";
import {
  fetchAllIndices,
  type SearchableSet,
} from "../../lib/content/search-index-loader";
import FilterBar, { type FilterDef } from "../../shared/forms/FilterBar";
import SearchField from "../../shared/forms/SearchField";
import SetDiscoveryCard, {
  type SetDiscoveryCardLabels,
  type SetDiscoveryDownloadState,
} from "../../shared/media/SetDiscoveryCard";
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
  const [loading, setLoading] = useState(true);
  const [rawQuery, setRawQuery] = useState("");
  const [filters, setFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<DiscoverSort>("relevance");
  const [downloadState, setDownloadState] = useState<
    Record<string, SetDiscoveryDownloadState>
  >({});
  const [downloadProgress, setDownloadProgress] = useState<
    Record<string, { current: number; total: number }>
  >({});

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
        const sets = await fetchAllIndices(repos, {
          onRevalidated: () => {
            if (!cancelled) void refresh();
          },
        });
        if (cancelled) return;
        setAllSets(sets);
        const keys = new Set<string>();
        for (const set of sets) {
          if (isSetDownloaded(set, local.sets)) keys.add(discoverSetKey(set));
        }
        setDownloadedKeys(keys);
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
    async function refresh() {
      const repos = await collectDiscoveryRepos();
      const sets = await fetchAllIndices(repos);
      if (!cancelled) setAllSets(sets);
    }
    void load();
    return () => {
      cancelled = true;
    };
    // Run once on mount; t/lang only affect labels which re-render anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(
    () => queryDiscoverSets(allSets, filters, sort),
    [allSets, filters, sort],
  );

  // #772 — once the learner has downloaded a set this session, point them
  // back to the Content Browser ("Meine Inhalte"), where it now lives.
  const hasDownloaded = useMemo(
    () => Object.values(downloadState).some((state) => state === "done"),
    [downloadState],
  );

  const filterDefs: FilterDef[] = useMemo(() => {
    const all = { value: "", label: t("discover.filter.all", "All") };
    const languages = availableLanguages(allSets).map((code) => ({
      value: code,
      label: languageDisplayName(code, lang),
    }));
    const levels = availableLevels(allSets).map((level) => ({
      value: level,
      label: level.toUpperCase(),
    }));
    const domains = availableDomains(allSets).map((domain) => ({
      value: domain,
      label: t(`discover.domain.${domain}`, domain),
    }));
    return [
      { id: "language", label: t("discover.filter.language", "Language"), value: filters.language, options: [all, ...languages] },
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
          { value: "yes", label: t("discover.filter.yes", "Yes") },
          { value: "no", label: t("discover.filter.no", "No") },
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
  }, [allSets, filters, sort, t, lang]);

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

  function trustLabel(level: number): string {
    if (level >= 3) return t("discover.trust.official", "Officially recommended");
    if (level >= 2) return t("discover.trust.verified", "Verified");
    if (level >= 1) return t("discover.trust.validated", "Validated");
    return "";
  }

  if (loading) {
    return (
      <main id="main" className="page" data-testid="discover-loading">
        <p>{t("discover.loading", "Loading available content…")}</p>
      </main>
    );
  }

  return (
    <main id="main" className="page" data-testid="discover-page">
      <header className="mb-4 flex items-center gap-2">
        <Compass className="size-6 text-accent" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-semibold">{t("discover.title", "Discover content")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("discover.subtitle", "Find learning material before you download it.")}
          </p>
        </div>
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

      <SearchField
        value={rawQuery}
        onChange={setRawQuery}
        placeholder={t("discover.search_placeholder", "Spanisch, KI, Psychologie…")}
        ariaLabel={t("discover.search_aria", "Search available content")}
        clearLabel={t("discover.search_clear", "Clear search")}
        className="mb-3"
        testId="discover-search"
      />

      <FilterBar
        filters={filterDefs}
        onChange={handleFilterChange}
        className="mb-4"
        testId="discover-filters"
      />

      <p className="mb-3 text-sm text-muted-foreground" data-testid="discover-count">
        {t("discover.result.count", "{n} sets").replace("{n}", String(results.length))}
      </p>

      {allSets.length === 0 ? (
        <p className="text-muted-foreground" data-testid="discover-empty-none">
          {t("discover.empty.no_sets", "No content available yet.")}
        </p>
      ) : results.length === 0 ? (
        <p className="text-muted-foreground" data-testid="discover-empty-results">
          {t("discover.empty.no_results", "No results for “{query}”.").replace(
            "{query}",
            filters.query,
          )}
        </p>
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
    </main>
  );
}
