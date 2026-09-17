/**
 * Session-cached count of installed content sets with an update available
 * (#2904). The per-row ``update_available`` computation
 * (``cached_version !== null && cached_version !== latest``) is already
 * correct and already cheap — a manifest fetch + version-string compare —
 * it previously only ran when ``/content`` mounted, so a learner who never
 * opened that page never learned an update existed.
 *
 * This module does NOT change that computation or add new polling
 * infrastructure. It runs the existing ``listSets()`` call once per
 * browser session (module-level cache, first caller wins; a concurrent
 * second caller shares the same in-flight promise instead of firing a
 * second fetch) and hands the count to whichever chrome wants to surface
 * it — see {@link ../../../components/nav/NavContentUpdatesBadge}.
 */

import { getStorage } from "../../../storage";

/**
 * Fired on ``window`` whenever {@link invalidateContentUpdateCount} drops
 * the session cache (#2985) — chrome showing the count (the nav badge)
 * re-reads on it, so an applied update lowers the badge live instead of
 * only after a full app reload.
 */
export const CONTENT_UPDATES_CHANGED_EVENT =
  "adaptive-learner:content-updates-changed";

let cachedCount: number | null = null;
let inFlight: Promise<number> | null = null;
// Bumped by every invalidation: a fetch started BEFORE the bump may still
// resolve afterwards and must not write its stale result into the cache.
let generation = 0;

async function fetchUpdateCount(): Promise<number> {
  const { sets } = await getStorage().contentLoader.listSets();
  return sets.filter((s) => s.update_available).length;
}

/**
 * The number of installed content sets with a newer version available,
 * computed once per session and cached until an update is applied
 * ({@link invalidateContentUpdateCount}).
 *
 * @example
 * const n = await getContentUpdateCount(); // 0 on a fresh install
 */
export async function getContentUpdateCount(): Promise<number> {
  if (cachedCount !== null) return cachedCount;
  if (!inFlight) {
    const startedAt = generation;
    inFlight = fetchUpdateCount()
      .then((count) => {
        if (startedAt === generation) cachedCount = count;
        return count;
      })
      .finally(() => {
        if (startedAt === generation) inFlight = null;
      });
  }
  return inFlight;
}

/**
 * Drop the session cache and announce the change (#2985). Called after an
 * update is APPLIED (the manual per-set update, a repo sync) — the frozen
 * once-per-session cache otherwise kept the pre-update count alive until
 * a full app reload, which in the installed PWA practically never happens.
 */
export function invalidateContentUpdateCount(): void {
  generation += 1;
  cachedCount = null;
  inFlight = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CONTENT_UPDATES_CHANGED_EVENT));
  }
}

/** TEST-ONLY seam: drop the session cache so a test can start clean. */
export function _resetContentUpdateCountForTests(): void {
  generation += 1;
  cachedCount = null;
  inFlight = null;
}
