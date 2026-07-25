/**
 * Service-worker lesson-cache purge (#1819).
 *
 * The Workbox runtime cache ``adaptive-learner-lessons``
 * (StaleWhileRevalidate over lesson GETs) kept serving a DELETED set's
 * lessons - a deleted set could be resurrected from the SW cache. This
 * purge removes the set's entries on every delete, regardless of the
 * progress-delete opt-in. Diagnostic by nature, so it fails open: no
 * Cache API (test env, http, old browser) or a cache read error is a
 * zero-count no-op, never a thrown error.
 */

const LESSON_CACHE_NAME = "adaptive-learner-lessons";

/**
 * Remove every cached lesson entry of ``(source, setId)`` from the
 * service-worker lesson cache.
 *
 * @param source Content source (``owner/repo`` - slugged to ``owner--repo``
 *   in cache URLs, mirroring the backend cache layout).
 * @param setId The deleted set's id.
 * @returns The number of removed cache entries (0 on no-op/failure).
 *
 * @example
 * await purgeSetFromLessonCache("jane/repo", "fr-a1");
 */
export async function purgeSetFromLessonCache(
    source: string,
    setId: string,
): Promise<number> {
    if (typeof caches === "undefined" || !caches?.open) return 0;
    const slug = source.replace(/\//g, "--");
    const marker = `/sets/${slug}/${setId}/`;
    const markerBare = `/sets/${slug}/${setId}`;
    try {
        const cache = await caches.open(LESSON_CACHE_NAME);
        const requests = await cache.keys();
        let removed = 0;
        for (const request of requests) {
            const {pathname} = new URL(request.url);
            if (pathname.includes(marker) || pathname.endsWith(markerBare)) {
                if (await cache.delete(request)) removed += 1;
            }
        }
        return removed;
    } catch {
        return 0;
    }
}

/**
 * Remove ONE lesson's cached entry of ``(source, setId, filename)`` from the
 * service-worker lesson cache (#2064 single-lesson delete). A sibling lesson
 * of the same set keeps its cache entry. Same fail-open contract as
 * {@link purgeSetFromLessonCache}.
 *
 * @param source Content source (``owner/repo`` - slugged to ``owner--repo``).
 * @param setId The lesson's set id.
 * @param filename The lesson file (e.g. ``01-intro.json``).
 * @returns The number of removed cache entries (0 on no-op/failure).
 *
 * @example
 * await purgeLessonFromLessonCache("user-generated", "book42", "01-intro.json");
 */
export async function purgeLessonFromLessonCache(
    source: string,
    setId: string,
    filename: string,
): Promise<number> {
    if (typeof caches === "undefined" || !caches?.open) return 0;
    const slug = source.replace(/\//g, "--");
    const marker = `/sets/${slug}/${setId}/lessons/${filename}`;
    try {
        const cache = await caches.open(LESSON_CACHE_NAME);
        const requests = await cache.keys();
        let removed = 0;
        for (const request of requests) {
            if (new URL(request.url).pathname.endsWith(marker)) {
                if (await cache.delete(request)) removed += 1;
            }
        }
        return removed;
    } catch {
        return 0;
    }
}
