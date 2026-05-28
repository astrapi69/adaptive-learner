/**
 * Asset resolver with blob-URL lifecycle management
 * (Phase 54B / v1.37.0 / EXP — Asset Fetching for Picture
 * Choice).
 *
 * Goes through ``getStorage().contentLoader.getAsset()`` to
 * fetch a ``Blob`` (ApiStorage: HTTP proxy; DexieStorage:
 * IndexedDB lookup), wraps it in an object URL via
 * ``URL.createObjectURL``, and tracks ref-counts so the URL
 * survives as long as ANY mounted component uses it. When
 * the last consumer unmounts, the URL is revoked.
 *
 * Three callers in one process should NOT each create three
 * separate object URLs for the same asset — that wastes
 * memory + duplicates the IndexedDB read. The cache + ref-
 * count below dedupes both work and storage.
 *
 * In-flight de-duplication: if A starts resolving an asset
 * and B mounts before A's resolution finishes, B awaits the
 * SAME promise instead of firing a parallel fetch. Once the
 * promise resolves both callers share the same URL and the
 * ref-count reaches 2.
 *
 * Pure module-level state. Tests reset it via ``_resetForTests``.
 */

import {getStorage} from "../../storage";

interface AssetCacheEntry {
    url: string;
    refCount: number;
}

const _cache = new Map<string, AssetCacheEntry>();
const _pending = new Map<string, Promise<string | null>>();

/** Cache key: ``"{source}::{setId}::{assetPath}"``. The triple
 *  isolates assets across content sources + versions. */
function _cacheKey(
    source: string,
    setId: string,
    assetPath: string,
): string {
    return `${source}::${setId}::${assetPath}`;
}

/** Resolve an asset to an object URL. Returns ``null`` when
 *  the storage layer has no asset at the requested path —
 *  the resolver hook then surfaces the error so the consumer
 *  can fall back to a placeholder SVG / text-only display.
 *
 *  Acquires a +1 ref on success. The matching
 *  ``releaseAssetUrl`` MUST run when the consumer no longer
 *  needs the URL (typically a useEffect cleanup). */
export async function resolveAssetUrl(
    source: string,
    setId: string,
    assetPath: string,
): Promise<string | null> {
    const key = _cacheKey(source, setId, assetPath);
    // Cache hit — bump the ref-count and return the existing URL.
    const cached = _cache.get(key);
    if (cached) {
        cached.refCount += 1;
        return cached.url;
    }
    // In-flight resolution — await the same promise.
    let promise = _pending.get(key);
    if (!promise) {
        promise = (async (): Promise<string | null> => {
            try {
                const blob = await getStorage().contentLoader.getAsset(
                    source,
                    setId,
                    assetPath,
                );
                if (!blob) return null;
                const url = URL.createObjectURL(blob);
                _cache.set(key, {url, refCount: 0});
                return url;
            } finally {
                _pending.delete(key);
            }
        })();
        _pending.set(key, promise);
    }
    const url = await promise;
    if (url) {
        // Multiple callers awaiting the same promise each
        // get their own +1 ref-count.
        const entry = _cache.get(key);
        if (entry) entry.refCount += 1;
    }
    return url;
}

/** Release a previously-acquired URL. Idempotent against an
 *  unknown key (the matching resolve returned null), so
 *  cleanup paths can call it unconditionally. */
export function releaseAssetUrl(
    source: string,
    setId: string,
    assetPath: string,
): void {
    const key = _cacheKey(source, setId, assetPath);
    const entry = _cache.get(key);
    if (!entry) return;
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
        URL.revokeObjectURL(entry.url);
        _cache.delete(key);
    }
}

/** Test-only: drop every cache entry + revoke its URL.
 *  Vitest resets module state between test files; this gives
 *  per-test isolation when needed. */
export function _resetForTests(): void {
    for (const entry of _cache.values()) {
        try {
            URL.revokeObjectURL(entry.url);
        } catch {
            /* test environment may not implement revoke */
        }
    }
    _cache.clear();
    _pending.clear();
}

/** Test-only: read the cache state for assertions. */
export function _cacheSnapshot(): Array<{
    key: string;
    url: string;
    refCount: number;
}> {
    return Array.from(_cache.entries()).map(([key, entry]) => ({
        key,
        url: entry.url,
        refCount: entry.refCount,
    }));
}
