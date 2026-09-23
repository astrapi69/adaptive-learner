/**
 * Matching "Corrections as a separate view" preference (#3186).
 *
 * Decides how many views the Matching exercise offers after checking.
 * Presentation-only: never changes scoring, the SRS attempts or the
 * recorded raw answer.
 *
 *   - true (default): three views. "My answers" shows only the learner's
 *     own graded pairs, "Corrections" adds the correct partner under each
 *     mistake, "Solve" reveals the solution (#824).
 *   - false: the pre-#3186 two views (#977). "My answers" carries the
 *     correct partner inline, next to "Solve".
 *
 * Learners reported the inline corrections as noisy ("feels like
 * everything is wrong"), hence the three-view default.
 */

const KEY = "adaptive-learner.matching.separate_corrections";

export const DEFAULT_MATCHING_SEPARATE_CORRECTIONS = true;

/** Dispatched on the window when the preference changes in THIS tab
 *  (the native ``storage`` event only fires in other tabs). */
export const MATCHING_REVIEW_VIEWS_PREF_CHANGE_EVENT =
    "adaptive-learner:matching-review-views-pref";

/** Whether corrections get their own view, falling back to the default
 *  for an unset / unrecognised value or unavailable storage. */
export function readMatchingSeparateCorrections(): boolean {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* no-op: storage unavailable */
    }
    return DEFAULT_MATCHING_SEPARATE_CORRECTIONS;
}

/** Persist the preference and dispatch
 *  {@link MATCHING_REVIEW_VIEWS_PREF_CHANGE_EVENT} so same-tab listeners
 *  refresh. */
export function writeMatchingSeparateCorrections(separate: boolean): void {
    try {
        localStorage.setItem(KEY, String(separate));
        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new Event(MATCHING_REVIEW_VIEWS_PREF_CHANGE_EVENT),
            );
        }
    } catch {
        /* no-op: storage unavailable */
    }
}
