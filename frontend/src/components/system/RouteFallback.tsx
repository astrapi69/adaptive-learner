/**
 * RouteFallback — the loading + failure UI for lazily-loaded routes (#2573).
 *
 * The app code-splits every page (``lazyWithReload`` in ``App.tsx``). Before
 * this module the route ``<Suspense>`` used ``fallback={null}``, so a lazy
 * chunk that failed to load — or an IndexedDB recovery redirect that stalled
 * on iOS Safari — left the content area COMPLETELY BLANK under an intact
 * shell, with no message and no way to recover. That silent-blank state is
 * what made an iOS load hiccup user-fatal (a returning visitor landed on an
 * empty box between the header and the bottom nav).
 *
 * Two exports close that gap:
 *
 *   - {@link RouteLoading} — the Suspense fallback. Shows a spinner + an
 *     accessible "Loading" label immediately, and after ``slowAfterMs``
 *     escalates to a readable "taking longer than expected" line plus a
 *     Reload button. That escalation is the safety net for a chunk that
 *     never resolves (the stall case, which an error boundary cannot catch
 *     because nothing is thrown).
 *   - {@link RouteLoadError} — the content-scoped error-boundary fallback.
 *     A lazy import that REJECTS throws into the boundary; this renders a
 *     readable "this view could not be loaded" message plus a Reload button,
 *     scoped to the content area so the surrounding shell stays usable.
 *
 * Both live inside the I18nProvider (see ``App.tsx``), so labels come from
 * ``t(key, fallback)`` with English fallbacks. Token-backed Tailwind only;
 * 44px touch target on the reload button.
 */

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "../../hooks/ui/useI18n";

/** Reload the current document — the fastest recovery from a failed/stalled
 *  chunk load (a fresh navigation re-fetches ``index.html`` + its chunks). */
function reloadApp(): void {
    if (typeof window !== "undefined") window.location.reload();
}

export interface RouteLoadingProps {
    /** Milliseconds before the "taking longer than expected" + Reload
     *  affordance appears. Default 10000; lowered in tests. */
    slowAfterMs?: number;
    testId?: string;
}

/**
 * Suspense fallback for lazy routes: an immediate, VISIBLE loading state
 * that escalates to a reload affordance when the chunk takes too long
 * (or never arrives).
 */
export function RouteLoading({ slowAfterMs = 10000, testId = "route-loading" }: RouteLoadingProps) {
    const { t } = useI18n();
    const [slow, setSlow] = useState(false);

    useEffect(() => {
        const id = window.setTimeout(() => setSlow(true), slowAfterMs);
        return () => window.clearTimeout(id);
    }, [slowAfterMs]);

    return (
        <div
            role="status"
            aria-live="polite"
            data-testid={testId}
            className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center"
        >
            <Loader2
                size={32}
                aria-hidden="true"
                className="animate-spin text-fg-muted"
                data-testid={`${testId}-spinner`}
            />
            <p className="text-sm text-fg-secondary">{t("app.loading", "Loading…")}</p>

            {slow && (
                <div className="flex flex-col items-center gap-3" data-testid={`${testId}-slow`}>
                    <p className="max-w-sm text-sm text-fg-muted">
                        {t("app.loading_slow", "This is taking longer than expected.")}
                    </p>
                    <button
                        type="button"
                        onClick={reloadApp}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90"
                        data-testid={`${testId}-reload`}
                    >
                        {t("app.reload", "Reload")}
                    </button>
                </div>
            )}
        </div>
    );
}

export interface RouteLoadErrorProps {
    /** The error thrown by the failed lazy import (message shown muted). */
    error?: Error;
    testId?: string;
}

/**
 * Content-scoped error-boundary fallback for a lazy route whose import
 * REJECTED. Rendered inside the shell, so the header + nav stay usable while
 * the content area explains the failure and offers a reload.
 */
export function RouteLoadError({ error, testId = "route-load-error" }: RouteLoadErrorProps) {
    const { t } = useI18n();
    return (
        <div
            role="alert"
            data-testid={testId}
            className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center"
        >
            <p className="text-base font-medium text-fg-primary">
                {t("app.view_load_failed", "This view could not be loaded.")}
            </p>
            {error?.message && (
                <p className="max-w-md text-xs text-fg-muted" data-testid={`${testId}-detail`}>
                    {error.message}
                </p>
            )}
            <button
                type="button"
                onClick={reloadApp}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90"
                data-testid={`${testId}-reload`}
            >
                {t("app.reload", "Reload")}
            </button>
        </div>
    );
}
