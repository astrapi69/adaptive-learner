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
 * ``lib/content/discover-repos`` (repo assembly). The page composes one hook
 * per concern (#3271: catalogue loading, filter state, facet options, per-set
 * actions) with the section components under ``components/content/discover``.
 */

import { useI18n } from "../../hooks/ui/useI18n";
import { useDiscoverCatalogue } from "../../hooks/content/discover/useDiscoverCatalogue";
import { useDiscoverFacets } from "../../hooks/content/discover/useDiscoverFacets";
import { useDiscoverFilters } from "../../hooks/content/discover/useDiscoverFilters";
import { useDiscoverSetActions } from "../../hooks/content/discover/useDiscoverSetActions";
import PageContainer from "../../shared/layout/PageContainer";
import SearchFilterBar from "../../shared/forms/SearchFilterBar";
import { Button } from "@/components/ui/button";
import ActiveFilterChips from "../../shared/forms/ActiveFilterChips";
import DiscoverPairMatrix from "../../components/content/DiscoverPairMatrix";
import {
  DiscoverAxisRow,
  DiscoverHeader,
  DiscoverNoResults,
  DiscoverNoSets,
  DiscoverResults,
} from "../../components/content/discover";
import ContentViewToggle from "../../components/content/browser/ContentViewToggle";
import { useContentViewMode } from "../../hooks/content/useContentViewMode";

/** The Discover page: catalogue, filters, facets and per-set actions. */
export default function Discover() {
  const { t } = useI18n();
  const { allSets, downloadedKeys, setDownloadedKeys, newKeys, loading } =
    useDiscoverCatalogue();
  const query = useDiscoverFilters(allSets);
  const facets = useDiscoverFacets({
    allSets,
    filters: query.filters,
    sort: query.sort,
    effectiveSourceLanguage: query.effectiveSourceLanguage,
    effectiveEntry: query.effectiveEntry,
    clearFacet: query.clearFacet,
  });
  const actions = useDiscoverSetActions({ setDownloadedKeys });
  // #1262 — grid (card) ⇄ list view, fed by the GLOBAL content-view
  // preference (#1257, default list) shared with "Meine Inhalte".
  const [viewMode, setViewMode] = useContentViewMode();

  if (loading) {
    return (
      <PageContainer testId="discover-loading">
        <p>{t("discover.loading", "Loading available content…")}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer testId="discover-page">
      <DiscoverHeader hasDownloaded={actions.hasDownloaded} />

      <SearchFilterBar
        searchValue={query.rawQuery}
        onSearchChange={query.setRawQuery}
        searchPlaceholder={t("discover.search_placeholder", "Spanisch, KI, Psychologie…")}
        searchAriaLabel={t("discover.search_aria", "Search available content")}
        searchClearLabel={t("discover.search_clear", "Clear search")}
        searchTestId="discover-search"
        filters={facets.filterDefs}
        onFilterChange={query.handleFilterChange}
        filtersTestId="discover-filters"
        searchButtonLabel={t("discover.bar.search", "Search")}
        filterButtonLabel={t("discover.bar.filter", "Filter")}
        className="mb-3"
        testId="discover-search-filter"
      />

      <DiscoverAxisRow
        entryOptions={facets.entryOptions}
        entry={query.effectiveEntry}
        onEntryChange={query.handleEntryChange}
        languageOptions={facets.languageOptions}
        sourceLanguage={query.effectiveSourceLanguage}
        onSourceLanguageChange={query.setLangChoice}
        showTargetFacet={facets.showTargetFacet}
        targetLanguageOptions={facets.targetLanguageOptions}
        targetLanguage={query.filters.targetLanguage}
        onTargetLanguageChange={query.setTargetLanguage}
      />

      {/* #2337 — the language-pair matrix: an alternative entry that presets
          the whole "German → Spanish" pair in one tap, including pairs in other
          instruction languages. The connected wrapper derives + formats the
          pairs and hides itself in the knowledge entry / single-pair case. */}
      <DiscoverPairMatrix
        sets={allSets}
        entry={query.effectiveEntry}
        activeSource={query.effectiveSourceLanguage}
        activeTarget={query.filters.targetLanguage}
        onSelect={query.handlePairSelect}
      />

      {/* #2323 — every other active restriction as a removable mark, on one
          horizontally-scrollable line (the phone's single visible filter
          surface). Absent when nothing beyond the source default is set. */}
      {facets.activeChips.length > 0 && (
        <div className="mb-4">
          <ActiveFilterChips
            chips={facets.activeChips}
            removeLabel={(label) =>
              t("discover.chips.remove", "Remove {f}").replace("{f}", label)
            }
            onClearAll={facets.hasAddedFilter ? query.resetAllFilters : undefined}
            clearAllLabel={t("discover.empty.reset_all", "Reset all filters")}
            testId="discover-active-filters"
          />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" data-testid="discover-count">
          {t("discover.result.count", "{n} sets").replace("{n}", String(query.results.length))}
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
        <DiscoverNoSets />
      ) : query.results.length === 0 ? (
        <DiscoverNoResults
          query={query.filters.query}
          sourceLanguageActive={query.effectiveSourceLanguage !== ""}
          onShowAllLanguages={() => query.setLangChoice("")}
          relaxHints={query.relaxHints}
          onClearFacet={query.clearFacet}
          hasAddedFilter={facets.hasAddedFilter}
          onResetAll={query.resetAllFilters}
        />
      ) : (
        <DiscoverResults
          viewMode={viewMode}
          sets={query.visibleResults}
          downloadedKeys={downloadedKeys}
          newKeys={newKeys}
          downloadState={actions.downloadState}
          downloadProgress={actions.downloadProgress}
          onDownload={actions.handleDownload}
          onRemove={actions.handleRemove}
        />
      )}

      {/* #2333 — extend the list one batch at a time; the count above the list
          stays the full number. No infinite scroll (keeps the back-path and the
          honest result size), no hard cap. */}
      {query.hasMore && (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={query.showMore}
            data-testid="discover-show-more"
          >
            {t("discover.result.show_more", "Show more")}
          </Button>
        </div>
      )}
    </PageContainer>
  );
}
