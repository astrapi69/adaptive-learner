/**
 * S4 (PWA hardening) — offline cache inspection + clearing.
 *
 * Reports the size + lesson count of the service worker's
 * ``adaptive-learner-lessons`` Cache Storage (the cache the S1 route +
 * S1 SWR strategy populate) and lets the user clear it from Settings.
 *
 * Auto-cleanup is NOT done here: the SW route configures Workbox
 * ``expiration`` (max 500 entries / 90 days, LRU), which bounds the
 * cache at the service-worker layer far more robustly than an
 * app-side byte scan could. This module is the read + manual-clear
 * surface only.
 */

export const LESSON_CACHE_NAME = "adaptive-learner-lessons";

export interface CacheInfo {
  /** Total bytes across the lesson cache's responses. */
  bytes: number;
  /** Number of cached ``/lessons/*.json`` entries. */
  lessonCount: number;
}

function isLessonUrl(url: string): boolean {
  try {
    return /\/lessons\/[^/]+\.json$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * Sum the byte size + count the lessons in the offline cache. Returns
 * zeros when Cache Storage is unavailable (no SW / unsupported / test
 * env) so the UI degrades to an empty state, never an error.
 */
export async function getCacheInfo(): Promise<CacheInfo> {
  if (typeof caches === "undefined") return { bytes: 0, lessonCount: 0 };
  let cache: Cache;
  try {
    cache = await caches.open(LESSON_CACHE_NAME);
  } catch {
    return { bytes: 0, lessonCount: 0 };
  }
  const requests = await cache.keys();
  let bytes = 0;
  let lessonCount = 0;
  for (const request of requests) {
    if (isLessonUrl(request.url)) lessonCount += 1;
    try {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        bytes += blob.size;
      }
    } catch {
      // Unreadable entry — skip its bytes.
    }
  }
  return { bytes, lessonCount };
}

/** Delete the entire offline lesson cache. No-op when unsupported. */
export async function clearLessonCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(LESSON_CACHE_NAME);
  } catch {
    // Nothing actionable.
  }
}

/** Format a byte count as a 1-decimal MB string (e.g. ``1.4``). */
export function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
