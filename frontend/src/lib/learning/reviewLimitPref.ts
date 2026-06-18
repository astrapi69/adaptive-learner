/**
 * Review-session length preference (#718).
 *
 * Controls how many elements a single SRS review session presents before
 * it ends (the weakest + oldest first; the queue already prioritises).
 * Stored in localStorage so it survives reloads and applies in both
 * storage modes (API + Dexie) without a schema change — the same pattern
 * as ``maxLessonSizePref``.
 *
 * Allowed values: 5 / 10 / 15 / 20; default 10 (lowered from the former
 * hardcoded 20). A "quick review" (#628) keeps its own fixed 5.
 */

export const REVIEW_LIMIT_PREF_KEY = "adaptive-learner.review_limit";

export const REVIEW_LIMIT_OPTIONS = [5, 10, 15, 20] as const;
export const DEFAULT_REVIEW_LIMIT_PREF = 10;

/** Read the configured review-session length, clamped to an allowed
 *  option (falls back to the default for missing / invalid values). */
export function readReviewLimit(): number {
    try {
        const raw = localStorage.getItem(REVIEW_LIMIT_PREF_KEY);
        if (raw === null) return DEFAULT_REVIEW_LIMIT_PREF;
        const parsed = parseInt(raw, 10);
        return (REVIEW_LIMIT_OPTIONS as readonly number[]).includes(parsed)
            ? parsed
            : DEFAULT_REVIEW_LIMIT_PREF;
    } catch {
        return DEFAULT_REVIEW_LIMIT_PREF;
    }
}

/** Persist the review-session length (ignored when not an allowed option). */
export function writeReviewLimit(limit: number): void {
    if (!(REVIEW_LIMIT_OPTIONS as readonly number[]).includes(limit)) return;
    try {
        localStorage.setItem(REVIEW_LIMIT_PREF_KEY, String(limit));
    } catch {
        /* localStorage unavailable */
    }
}
