/**
 * Deploy-safe ``React.lazy`` (#113).
 *
 * On the GitHub-Pages build every route is a dynamic ``import()``. After
 * a new deploy the old hashed chunks are purged, but a stale
 * ``index.html`` / service-worker cache can still reference them — so
 * navigating to a not-yet-loaded route throws "Failed to fetch
 * dynamically imported module" and crashes into the error boundary.
 *
 * ``lazyWithReload`` turns that into a single automatic reload: a
 * chunk-load failure reloads the page once (guarded against loops) to
 * fetch the fresh index + chunks; a successful load clears the guard.
 * Non-chunk errors, and a second failure after the reload, propagate
 * normally so genuine bugs still surface.
 */

import {lazy, type ComponentType} from "react";

const RELOAD_FLAG = "adaptive-learner.chunk-reload";

/**
 * True for the family of errors browsers throw when a dynamically
 * imported chunk cannot be fetched — the signature of a stale index
 * pointing at a hashed chunk a newer deploy has removed.
 */
export function isChunkLoadError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return (
        /failed to fetch dynamically imported module/i.test(message) ||
        /error loading dynamically imported module/i.test(message) ||
        /importing a module script failed/i.test(message) || // Safari
        /chunkloaderror/i.test(message)
    );
}

/**
 * Whether a failed import should trigger an automatic reload: only for
 * chunk-load errors, and only if a reload has not already been tried
 * (so a genuinely missing chunk or an offline state cannot loop).
 */
export function shouldReloadForChunkError(
    err: unknown,
    alreadyReloaded: boolean,
): boolean {
    return isChunkLoadError(err) && !alreadyReloaded;
}

function readReloadFlag(): boolean {
    try {
        return sessionStorage.getItem(RELOAD_FLAG) === "1";
    } catch {
        return false;
    }
}

function setReloadFlag(): void {
    try {
        sessionStorage.setItem(RELOAD_FLAG, "1");
    } catch {
        /* no-op */
    }
}

function clearReloadFlag(): void {
    try {
        sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
        /* no-op */
    }
}

/**
 * ``React.lazy`` wrapper that triggers a single full reload when
 * a dynamic chunk import fails because of a stale deploy. The
 * one-shot reload flag prevents a reload loop for genuinely
 * missing chunks or offline states.
 */
export function lazyWithReload<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the canonical React.lazy generic
    T extends ComponentType<any>,
>(factory: () => Promise<{default: T}>) {
    return lazy(async () => {
        try {
            const mod = await factory();
            clearReloadFlag();
            return mod;
        } catch (err) {
            if (shouldReloadForChunkError(err, readReloadFlag())) {
                setReloadFlag();
                window.location.reload();
                // Block until the reload navigates away so the rejected
                // import never reaches the Suspense error boundary.
                return await new Promise<{default: T}>(() => {});
            }
            throw err;
        }
    });
}
