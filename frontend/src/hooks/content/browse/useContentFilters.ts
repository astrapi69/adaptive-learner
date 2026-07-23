/**
 * useContentFilters (#1793 — extracted from Content.tsx).
 *
 * The Content-Browser filter concern: the #1300 lifecycle status
 * filter, the EXP-023 source filter, the derived menu options, the
 * visible-set projection, and the #1386 search-AND-filter result
 * ("never filter silently" — matches whose set fails the active
 * filters are dropped from the search list).
 */

import { useState } from "react";

import { isOfficialSource } from "../../../lib/content/repos/content-repos";
import {
  STATUS_FILTER_ORDER,
  matchesStatusFilter,
  type StatusFilter,
} from "../../../lib/content/browse/set-status-filter";
import type { ContentSearchResult } from "../../../lib/content/browse/content-search";
import type { ContentSetEntry } from "../../../storage/types";

/** i18n translate signature (key + fallback). */
type Translate = (key: string, fallback: string) => string;

export interface FilterMenuOption {
  value: string;
  label: string;
}

/**
 * Own the Content-Browser status/source filter state and every
 * projection derived from it.
 *
 * @example
 * const filters = useContentFilters({t, sets, downloadedSets, searchResult});
 * <FilterMenuButton options={filters.statusOptions}
 *     value={filters.statusFilter} onChange={filters.setStatusFilterValue} />
 */
export function useContentFilters({
  t,
  sets,
  downloadedSets,
  searchResult,
}: {
  t: Translate;
  sets: ContentSetEntry[];
  downloadedSets: ContentSetEntry[];
  searchResult: ContentSearchResult;
}) {
  // EXP-023 Phase B — source filter: "all" / "official" / a specific
  // user-repo source ("owner/repo").
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  // #1300 — lifecycle status filter. Default "active" so "Meine Inhalte"
  // opens on the clean working list; deferred/completed/all reachable here.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  // EXP-023 Phase A — when a user repo is connected, offer a source
  // filter (Alle / Offiziell / Eigenes Repo) over the tree.
  const userRepoSources = [
    ...new Set(
      downloadedSets
        .filter((s) => !isOfficialSource(s.source))
        .map((s) => s.source),
    ),
  ];
  const visibleSets = downloadedSets.filter((s) => {
    // #1300 — status filter (default "active"); "all" passes every status.
    if (!matchesStatusFilter(s, statusFilter)) return false;
    if (sourceFilter === "all") return true;
    if (sourceFilter === "official") return isOfficialSource(s.source);
    return s.source === sourceFilter;
  });

  // #1386 — the status + source filters render as two menu buttons (the
  // SetActionsMenu pattern; never a native select). Options are derived
  // dynamically; the source button is ALWAYS visible so the learner can
  // see what the list is (not) filtered to.
  const statusOptions: FilterMenuOption[] = STATUS_FILTER_ORDER.map(
    (value) => ({
      value,
      label:
        value === "all"
          ? t("content.set_status.all", "All")
          : value === "active"
            ? t("content.set_status.active", "Active")
            : value === "deferred"
              ? t("content.set_status.deferred", "Deferred")
              : t("content.set_status.completed", "Completed"),
    }),
  );
  const hasOfficialSets = downloadedSets.some((s) =>
    isOfficialSource(s.source),
  );
  const sourceOptions: FilterMenuOption[] = [
    { value: "all", label: t("content.filter.all_sources", "All sources") },
    ...(hasOfficialSets
      ? [{ value: "official", label: t("content.filter.official", "Official") }]
      : []),
    ...userRepoSources.map((src) => ({ value: src, label: src })),
  ];
  const passesSourceFilter = (entry: ContentSetEntry) =>
    sourceFilter === "all"
      ? true
      : sourceFilter === "official"
        ? isOfficialSource(entry.source)
        : entry.source === sourceFilter;

  // #1386 — search combines with the filters as AND (never filter silently:
  // the filter row stays visible while searching). Matches whose set fails
  // the active status/source filters are dropped from the result list.
  const filterPassKeys = new Set(
    sets
      .filter(
        (s) => matchesStatusFilter(s, statusFilter) && passesSourceFilter(s),
      )
      .map((s) => `${s.source}#${s.id}`),
  );
  const filteredMatches = searchResult.matches.filter((m) =>
    filterPassKeys.has(`${m.source}#${m.setId}`),
  );
  const filteredSearchResult = {
    ...searchResult,
    matches: filteredMatches,
    lessonCount: filteredMatches.reduce(
      (n, m) => n + m.matchedLessons.length,
      0,
    ),
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setSourceFilter("all");
  };

  return {
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    statusOptions,
    sourceOptions,
    visibleSets,
    filteredSearchResult,
    resetFilters,
  };
}
