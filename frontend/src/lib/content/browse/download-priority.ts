/**
 * download-priority — the canonical "downloaded content first" ordering used
 * everywhere sets/lessons are listed (Learning Path, Dashboard Continue
 * Learning, Meine Inhalte). Single source of truth so the surfaces can't drift
 * (#909).
 *
 * Three tiers, top to bottom:
 *   1. Downloaded + started (has any progress / last activity) — most-recently
 *      used first.
 *   2. Downloaded + not started — most-recently used first (none → title).
 *   3. Not downloaded — last.
 *
 * Pure + app-agnostic: callers map their domain object onto {@link
 * DownloadPriorityItem} and pass it in. No app imports, no side effects, so it
 * unit-tests without a DOM.
 */

/** The minimal shape the ordering needs from any set/lesson. */
export interface DownloadPriorityItem {
  /** Whether the set/lesson is downloaded (locally available). */
  downloaded: boolean;
  /** ISO timestamp of the last activity, or ``null`` when never touched. */
  lastActivity: string | null;
  /** Display title, used as the stable tiebreaker within a tier. */
  title: string;
}

/**
 * Tier rank for an item: lower sorts first.
 *   0 — downloaded + started, 1 — downloaded + not started, 2 — not downloaded.
 */
export function downloadPriorityRank(item: DownloadPriorityItem): 0 | 1 | 2 {
  if (!item.downloaded) return 2;
  return item.lastActivity ? 0 : 1;
}

/**
 * Comparator implementing the 3-tier "downloaded first" ordering. Within the
 * started tier, most-recent activity wins; ties (and the untouched tiers) fall
 * back to a case-insensitive title sort so the order is deterministic.
 *
 * @example
 * sets.sort(compareByDownloadPriority);
 */
export function compareByDownloadPriority(
  a: DownloadPriorityItem,
  b: DownloadPriorityItem,
): number {
  const ra = downloadPriorityRank(a);
  const rb = downloadPriorityRank(b);
  if (ra !== rb) return ra - rb;

  // Same tier: started tiers order by most-recent activity first.
  if (ra === 0 && a.lastActivity && b.lastActivity) {
    if (a.lastActivity > b.lastActivity) return -1;
    if (a.lastActivity < b.lastActivity) return 1;
  }
  return a.title.localeCompare(b.title);
}
