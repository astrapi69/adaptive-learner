/**
 * review/reviewPref — local preference for showing the auto-generated
 * error explanations (#599). localStorage, mode-agnostic, with a change
 * event (same pattern as feedbackPref / hintPref).
 */

const KEY_EXPLANATIONS = "adaptive-learner.review.explanations";

export const DEFAULT_EXPLANATIONS_ENABLED = true;
export const REVIEW_PREF_CHANGE_EVENT = "adaptive-learner:review-pref";

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
