/**
 * Reviews-changed signal (#629, BUG 3c).
 *
 * A lightweight same-tab notification that the SRS review state has
 * changed (an element was attempted in a review session, so its
 * suggested-review time moved). ``NavReviewsBadge`` subscribes to it so
 * the "N due" header count recomputes live — without it the badge would
 * stay stale until the next route change / tab focus, which is exactly
 * the "badge still shows N after finishing the session" complaint.
 *
 * A bare window ``Event`` (not the celebration bus): recording a review
 * attempt is not a celebration, and this keeps the producer
 * (``useReviewLesson``) free of the celebration/sound machinery.
 */

export const REVIEWS_CHANGED_EVENT = "adaptive-learner:reviews-changed";

/** Fire-and-forget notification that review/SRS state changed. Safe to
 *  call in any environment (no-op when ``window`` is unavailable). */
export function notifyReviewsChanged(): void {
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(REVIEWS_CHANGED_EVENT));
        }
    } catch {
        /* no-op — a notification failure must never break recording */
    }
}
