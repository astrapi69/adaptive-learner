/**
 * Friendly error-message mapping (DEV-MODE-FRIENDLY-ERRORS-01).
 *
 * Production-mode users never see HTTP status codes, endpoint
 * paths, or stack traces in toasts. ``notify.error`` calls this
 * helper when the caller supplied an ``ApiError`` AND Developer
 * Mode is off, replacing the raw technical message with a
 * status-code-mapped friendly string from the i18n catalogue
 * (``ui.errors.*``). Dev mode bypasses the substitution and
 * shows the technical message verbatim.
 *
 * The original ``ApiError`` is always forwarded to the
 * ErrorReportDialog regardless of mode, so the GitHub issue
 * body keeps the full technical detail even when the user
 * only saw the friendly toast.
 */

import {ApiError} from "../api/client";
import {resolveI18n} from "../hooks/ui/useI18n";

/**
 * Subset of ApiError properties relevant for friendly-message
 * mapping. Accepts the full class as well; the mapper only
 * reads ``status``.
 */
interface ApiErrorLike {
    status?: number;
}

/**
 * Generic fallback when the status code does not match a
 * specific mapping. The English literal is the last-resort
 * fallback if the i18n catalogue is empty.
 */
const GENERIC_FALLBACK_KEY = "ui.errors.generic";
const GENERIC_FALLBACK_TEXT =
    "Something went wrong. Please try again later.";

/**
 * Map a status code to its ``ui.errors.<code>`` key. Groups
 * ``401`` + ``403`` under ``forbidden`` because they read the
 * same to users. Server errors collapse to ``server``. Anything
 * unrecognised falls through to ``generic``.
 */
function keyForStatus(status: number): string {
    if (status === 400 || status === 422) return "ui.errors.bad_request";
    if (status === 401 || status === 403) return "ui.errors.forbidden";
    if (status === 404) return "ui.errors.not_found";
    if (status === 409) return "ui.errors.conflict";
    if (status === 429) return "ui.errors.rate_limited";
    if (status === 502 || status === 503 || status === 504)
        return "ui.errors.upstream_unavailable";
    if (status >= 500) return "ui.errors.server";
    return GENERIC_FALLBACK_KEY;
}

/**
 * Per-status English fallbacks. Used when the i18n catalogue
 * hasn't loaded yet (first-paint resilience).
 */
const ENGLISH_FALLBACKS: Record<string, string> = {
    "ui.errors.bad_request": "The request could not be processed.",
    "ui.errors.forbidden":
        "Access denied. Please check your settings.",
    "ui.errors.not_found": "This page or feature was not found.",
    "ui.errors.conflict": "This action conflicts with the current state.",
    "ui.errors.rate_limited":
        "Too many requests. Please wait a moment and try again.",
    "ui.errors.upstream_unavailable":
        "The AI service is currently unreachable.",
    "ui.errors.server": "An internal error occurred.",
    "ui.errors.network": "No connection to the server.",
    "ui.errors.timeout": "The request took too long.",
    [GENERIC_FALLBACK_KEY]: GENERIC_FALLBACK_TEXT,
};

/**
 * Resolve a ``ui.errors.*`` key against the i18n catalogue with
 * a built-in English fallback. The Settings page lets users
 * pick a language at any time; this helper always reads the
 * current language's translation.
 */
function lookupFriendly(key: string): string {
    return resolveI18n(key, ENGLISH_FALLBACKS[key] ?? GENERIC_FALLBACK_TEXT);
}

/**
 * Build the user-facing friendly message for an ApiError.
 * When no status is available (defensive — the apiCall path
 * always sets one), returns the generic fallback.
 */
export function friendlyErrorMessage(error: ApiError | ApiErrorLike): string {
    if (typeof error.status !== "number") {
        return lookupFriendly(GENERIC_FALLBACK_KEY);
    }
    return lookupFriendly(keyForStatus(error.status));
}

/**
 * Friendly message for a network-level failure (fetch throws
 * before a Response lands — ECONNREFUSED, DNS, CORS, etc.).
 * Callers supply this directly rather than constructing a
 * pseudo-ApiError.
 */
export function friendlyNetworkErrorMessage(): string {
    return lookupFriendly("ui.errors.network");
}

/**
 * Friendly message for a request that exceeded its timeout.
 */
export function friendlyTimeoutMessage(): string {
    return lookupFriendly("ui.errors.timeout");
}
