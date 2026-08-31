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
  /**
   * ISO timestamp of when the set was downloaded, or ``null``/absent when
   * unknown (e.g. API mode, which has no per-set download time). Drives the
   * "most recently downloaded first" ordering of the untouched tier (#1211).
   */
  downloadedAt?: string | null;
  /** Display title, used as the stable tiebreaker within a tier. */
  title: string;
}

/**
 * Descending ISO-timestamp compare. Returns <0 when ``a`` is newer (sorts
 * first), >0 when ``b`` is newer; an absent/null timestamp is treated as
 * oldest, so it sorts after any real timestamp. Equal/both-null → 0 so the
 * caller falls through to its next tiebreaker (a stable title sort).
 */
function compareTimestampDesc(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const av = a ?? "";
  const bv = b ?? "";
  if (av === bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return av > bv ? -1 : 1;
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
 * Comparator implementing the 3-tier "downloaded first" ordering.
 *
 *   - Started tier (0): most-recent activity first, then most-recent download
 *     as a secondary tiebreaker.
 *   - Untouched-downloaded tier (1): most-recent DOWNLOAD first (#1211) — a
 *     freshly downloaded set surfaces at the top of its tier instead of being
 *     buried alphabetically.
 *   - Not-downloaded tier (2): title only.
 *
 * Every tier falls back to a case-insensitive title sort so the order is
 * deterministic (equal/missing timestamps never flicker).
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

  if (ra === 0) {
    // Started tier: most-recent activity first, then most-recent download.
    const byActivity = compareTimestampDesc(a.lastActivity, b.lastActivity);
    if (byActivity !== 0) return byActivity;
    const byDownload = compareTimestampDesc(a.downloadedAt, b.downloadedAt);
    if (byDownload !== 0) return byDownload;
  } else if (ra === 1) {
    // Untouched-downloaded tier: most-recent download first (#1211).
    const byDownload = compareTimestampDesc(a.downloadedAt, b.downloadedAt);
    if (byDownload !== 0) return byDownload;
  }
  return a.title.localeCompare(b.title);
}
