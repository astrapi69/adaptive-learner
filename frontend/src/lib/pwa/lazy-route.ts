/**
 * pwa/lazy-route — deploy-safe ``React.lazy`` bound to the app's storage
 * namespace (#113, #1873).
 *
 * The mechanism lives in ``@astrapi69/pwa-update-react``; this binding only
 * pins the namespace so the one-shot reload guard keeps its established key
 * (``adaptive-learner.chunk-reload``) instead of splitting the app's update
 * state across two prefixes.
 */

import { lazyWithReload as kitLazyWithReload } from "@astrapi69/pwa-update-react";
import type { ComponentType } from "react";

/** ``React.lazy`` that survives a stale deploy with a single guarded reload. */
export function lazyWithReload<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the canonical React.lazy generic
    T extends ComponentType<any>,
>(factory: () => Promise<{ default: T }>) {
    return kitLazyWithReload(factory, { storageNamespace: "adaptive-learner" });
}
