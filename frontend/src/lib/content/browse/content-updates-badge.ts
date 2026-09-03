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

let cachedCount: number | null = null;
let inFlight: Promise<number> | null = null;

async function fetchUpdateCount(): Promise<number> {
  const { sets } = await getStorage().contentLoader.listSets();
  return sets.filter((s) => s.update_available).length;
}

/**
 * The number of installed content sets with a newer version available,
 * computed once per session and cached for every subsequent call.
 *
 * @example
 * const n = await getContentUpdateCount(); // 0 on a fresh install
 */
export async function getContentUpdateCount(): Promise<number> {
  if (cachedCount !== null) return cachedCount;
  if (!inFlight) {
    inFlight = fetchUpdateCount()
      .then((count) => {
        cachedCount = count;
        return count;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** TEST-ONLY seam: drop the session cache so a test can start clean. */
export function _resetContentUpdateCountForTests(): void {
  cachedCount = null;
  inFlight = null;
}
