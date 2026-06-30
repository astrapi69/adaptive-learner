/**
 * Lifecycle status filtering for "Meine Inhalte" (#1300).
 *
 * Pure, side-effect-free helpers shared by the Content page (the filter
 * predicate) and its tests. A set with no explicit ``status`` is treated
 * as ``"active"`` (the pre-#1300 default + API-mode fallback), so old
 * cached sets always show in the default active view.
 */

import type { ContentSetEntry, SetStatus } from "../../../storage/types";

/** The status-filter choices: every concrete status plus "all". */
export type StatusFilter = "all" | SetStatus;

/** Default-on-render order: the working list first, "all" last. */
export const STATUS_FILTER_ORDER: StatusFilter[] = [
  "active",
  "deferred",
  "completed",
  "all",
];

/** The effective status of a set (missing → "active"). */
export function effectiveStatus(entry: ContentSetEntry): SetStatus {
  return entry.status ?? "active";
}

/** True when ``entry`` should be shown under ``filter`` ("all" passes
 *  everything; otherwise the effective status must match). */
export function matchesStatusFilter(
  entry: ContentSetEntry,
  filter: StatusFilter,
): boolean {
  return filter === "all" || effectiveStatus(entry) === filter;
}
