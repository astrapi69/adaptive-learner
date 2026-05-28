/**
 * useAsset — React hook for resolving a Content-Loader asset
 * to a renderable URL (Phase 54B / v1.37.0).
 *
 * Wraps the lower-level :func:`resolveAssetUrl` /
 * :func:`releaseAssetUrl` ref-counted resolver so React
 * components don't have to thread cleanup through their own
 * useEffect.
 *
 * Returned shape:
 *   - ``url``: the object URL when resolution succeeded,
 *     else ``null``
 *   - ``loading``: ``true`` while the fetch is in flight
 *   - ``error``: ``true`` when the storage layer has no
 *     asset at the path (the resolver returned ``null``)
 *
 * Consumers (e.g. PictureChoiceExercise) check ``error`` to
 * decide whether to render a placeholder SVG / text-only
 * fallback. Never throws — every storage layer failure
 * surfaces as ``error: true`` instead.
 */

import {useEffect, useState} from "react";

import {releaseAssetUrl, resolveAssetUrl} from "../lib/content/asset-resolver";

export interface UseAssetResult {
    url: string | null;
    loading: boolean;
    error: boolean;
}

const INITIAL: UseAssetResult = {url: null, loading: true, error: false};

export function useAsset(
    source: string | null | undefined,
    setId: string | null | undefined,
    assetPath: string | null | undefined,
): UseAssetResult {
    const [state, setState] = useState<UseAssetResult>(INITIAL);

    useEffect(() => {
        // Bail if any required argument is empty — the
        // consumer treats this as "nothing to render".
        if (!source || !setId || !assetPath) {
            setState({url: null, loading: false, error: true});
            return;
        }
        let cancelled = false;
        // Reset to loading on every key change.
        setState({url: null, loading: true, error: false});
        resolveAssetUrl(source, setId, assetPath)
            .then((url) => {
                if (cancelled) {
                    // The component unmounted (or its
                    // dependency key changed) before
                    // resolution completed. Release the ref
                    // we just acquired so the URL doesn't
                    // leak.
                    if (url) releaseAssetUrl(source, setId, assetPath);
                    return;
                }
                if (url) {
                    setState({url, loading: false, error: false});
                } else {
                    setState({url: null, loading: false, error: true});
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setState({url: null, loading: false, error: true});
                }
            });
        return () => {
            cancelled = true;
            // Release our ref. ``releaseAssetUrl`` is a no-op
            // when the cache has no matching entry (the
            // resolution failed), so this is safe whether or
            // not the promise above succeeded.
            releaseAssetUrl(source, setId, assetPath);
        };
    }, [source, setId, assetPath]);

    return state;
}
