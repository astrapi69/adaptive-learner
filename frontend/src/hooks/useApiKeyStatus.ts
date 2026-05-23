/**
 * Active-provider API-key status hook (Issue 4 / v1.23.1).
 *
 * Every UI surface that fires an AI call (Import Analyze,
 * Session Start, Anki Extract, NotebookLM Study Guide,
 * Pronunciation Practice, Dashboard Quick Start) needs the
 * same question answered: does the user's active AI provider
 * have an API key configured? If not, the action button must
 * be disabled with a clear inline reason — surfacing a 400
 * error toast after the click is a worse UX than preventing
 * the click in the first place.
 *
 * Shape:
 *
 *   const {ready, hasKey, activeProvider, refresh} =
 *     useApiKeyStatus();
 *
 *   - ``ready`` (boolean): true once the settings fetch has
 *     resolved (success OR failure). Buttons should treat
 *     ``ready=false`` as "still loading" — don't claim "no
 *     key" before we actually know.
 *   - ``hasKey`` (boolean): true iff the active provider's
 *     ``has_<provider>_key`` flag is true. False while not
 *     ready, and false on any fetch failure.
 *   - ``activeProvider`` (AIProvider | null): the resolved
 *     provider name, null until ready.
 *   - ``refresh()`` (function): re-fetch on demand. Use this
 *     from Settings after a key save so other tabs reflect
 *     the new state without a hard reload.
 *
 * Caching: the hook fetches ONCE per learnerState user id.
 * Cross-component reads do NOT re-fetch — a module-level
 * cache keyed by userId stores the last result + the
 * subscriber list. Storage-flow tests in
 * ``useApiKeyStatus.test.ts`` pin this.
 *
 * Stale-after-refresh: when the user changes their active
 * provider OR adds/removes a key, Settings calls
 * ``refreshApiKeyStatus()`` (the imperative companion).
 * Every mounted hook re-renders with the new value.
 */

import {useCallback, useEffect, useState} from "react";

import type {AIProvider} from "../lib/constants";
import {readLearnerState} from "../lib/learnerState";
import {getStorage} from "../storage";

interface ApiKeyStatus {
    ready: boolean;
    hasKey: boolean;
    activeProvider: AIProvider | null;
    refresh: () => Promise<void>;
}

type Snapshot = {
    ready: boolean;
    hasKey: boolean;
    activeProvider: AIProvider | null;
};

// Module-level cache keyed by userId. ``null`` userId
// (no learner state) doesn't fetch; the snapshot stays at the
// "not ready" default and callers must treat it as such.
const CACHE = new Map<string, Snapshot>();
const SUBSCRIBERS = new Set<() => void>();
const INFLIGHT = new Map<string, Promise<Snapshot>>();

function notifySubscribers() {
    for (const fn of SUBSCRIBERS) fn();
}

async function fetchSnapshot(userId: string): Promise<Snapshot> {
    const inflight = INFLIGHT.get(userId);
    if (inflight) return inflight;
    const promise = (async () => {
        try {
            const settings = await getStorage().settings.get(userId);
            const provider = settings.active_provider;
            const flag =
                provider === "anthropic"
                    ? settings.has_anthropic_key
                    : provider === "openai"
                      ? settings.has_openai_key
                      : provider === "gemini"
                        ? settings.has_gemini_key
                        : false;
            const snap: Snapshot = {
                ready: true,
                hasKey: !!flag,
                activeProvider: provider,
            };
            CACHE.set(userId, snap);
            return snap;
        } catch {
            // Failures are not fatal — the UI just treats the
            // provider as "no key" and the user gets the same
            // inline warning a freshly-onboarded user sees.
            const snap: Snapshot = {
                ready: true,
                hasKey: false,
                activeProvider: null,
            };
            CACHE.set(userId, snap);
            return snap;
        } finally {
            INFLIGHT.delete(userId);
        }
    })();
    INFLIGHT.set(userId, promise);
    return promise;
}

/**
 * Imperative refresh hook for Settings to call after a save.
 * Drops the cache and notifies every subscribed component so
 * they re-fetch + re-render.
 */
export async function refreshApiKeyStatus(): Promise<void> {
    const userId = readLearnerState().userId;
    if (!userId) return;
    CACHE.delete(userId);
    INFLIGHT.delete(userId);
    await fetchSnapshot(userId);
    notifySubscribers();
}

/** Test-only hook: drop the module-level cache between tests. */
export function _resetApiKeyStatusCacheForTests(): void {
    CACHE.clear();
    INFLIGHT.clear();
    SUBSCRIBERS.clear();
}

export function useApiKeyStatus(): ApiKeyStatus {
    const userId = readLearnerState().userId;
    const [, force] = useState(0);
    const snapshot: Snapshot =
        (userId && CACHE.get(userId)) || {
            ready: false,
            hasKey: false,
            activeProvider: null,
        };

    useEffect(() => {
        if (!userId) return;
        if (!CACHE.has(userId)) {
            void fetchSnapshot(userId).then(() => {
                force((v) => v + 1);
            });
        }
        const subscriber = () => force((v) => v + 1);
        SUBSCRIBERS.add(subscriber);
        return () => {
            SUBSCRIBERS.delete(subscriber);
        };
    }, [userId]);

    const refresh = useCallback(async () => {
        await refreshApiKeyStatus();
    }, []);

    return {
        ready: snapshot.ready,
        hasKey: snapshot.hasKey,
        activeProvider: snapshot.activeProvider,
        refresh,
    };
}
