/**
 * review/reviewPref — local preference for showing the auto-generated
 * error explanations (#599). localStorage, mode-agnostic, with a change
 * event (same pattern as feedbackPref / hintPref).
 */

const KEY_EXPLANATIONS = "adaptive-learner.review.explanations";

export const DEFAULT_EXPLANATIONS_ENABLED = true;
export const REVIEW_PREF_CHANGE_EVENT = "adaptive-learner:review-pref";

/** Read whether auto-generated error explanations are shown. Falls back
 *  to {@link DEFAULT_EXPLANATIONS_ENABLED} when unset or unreadable. */
export function readExplanationsEnabled(): boolean {
    try {
        const raw = localStorage.getItem(KEY_EXPLANATIONS);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* no-op */
    }
    return DEFAULT_EXPLANATIONS_ENABLED;
}

/** Persist the error-explanations preference and dispatch
 *  {@link REVIEW_PREF_CHANGE_EVENT} so subscribers re-read live in the
 *  same tab. Storage failures are swallowed. */
export function setExplanationsEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(KEY_EXPLANATIONS, enabled ? "true" : "false");
    } catch {
        /* no-op */
    }
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(REVIEW_PREF_CHANGE_EVENT));
    }
}
