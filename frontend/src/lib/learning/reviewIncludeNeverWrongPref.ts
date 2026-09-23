/**
 * "Also review error-free elements" preference (#3170).
 *
 * ``recordBulk`` seeds an SRS row for EVERY played element, a correct
 * first attempt included. Whether those never-wrong rows are scheduled
 * for spaced repetition (3 and 7 days later) or left alone is the
 * learner's call: OFF (the default) makes "Fehler trainieren" and the
 * review session an error-only affair; ON restores the pre-#3170 spaced
 * repetition of every non-mastered element.
 *
 * Stored in localStorage so it survives reloads and applies in both
 * storage modes (API + Dexie) without a schema change, the same pattern
 * as ``reviewLimitPref``. The ``adaptive-learner.`` prefix lets the value
 * ride the ``.alb`` backup's localStorage snapshot.
 */

export const REVIEW_INCLUDE_NEVER_WRONG_PREF_KEY =
    "adaptive-learner.review_include_never_wrong";

export const DEFAULT_REVIEW_INCLUDE_NEVER_WRONG = false;

/** Read whether never-wrong elements join the review queue (falls back to
 *  the default for a missing / invalid value). */
export function readReviewIncludeNeverWrong(): boolean {
    try {
        const raw = localStorage.getItem(REVIEW_INCLUDE_NEVER_WRONG_PREF_KEY);
        if (raw === "true") return true;
        if (raw === "false") return false;
        return DEFAULT_REVIEW_INCLUDE_NEVER_WRONG;
    } catch {
        return DEFAULT_REVIEW_INCLUDE_NEVER_WRONG;
    }
}

/** Persist the preference. Storage failures are swallowed. */
export function writeReviewIncludeNeverWrong(enabled: boolean): void {
    try {
        localStorage.setItem(
            REVIEW_INCLUDE_NEVER_WRONG_PREF_KEY,
            enabled ? "true" : "false",
        );
    } catch {
        /* localStorage unavailable */
    }
}
