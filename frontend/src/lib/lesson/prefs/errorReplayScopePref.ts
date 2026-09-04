/**
 * Error-replay scope preference (#1874).
 *
 * Controls what "Fehler wiederholen" (Retry Errors) replays:
 *
 *  - ``errors_only`` (DEFAULT) — only the elements the learner got wrong.
 *    For matching exercises this trims the ``pairs`` list down to the wrong
 *    pairs (see ``narrowReplayExercises``), so a mixed-result matching
 *    exercise no longer replays every pair.
 *  - ``whole_set`` — the full failed exercises unchanged (every matching
 *    pair, every cloze blank), for learners who want the complete context
 *    again.
 *
 * Presentation/input-only: it never changes grading, XP, or progress —
 * only WHICH pairs/elements are shown on the replay screen. Stored in
 * localStorage so it works identically in both storage modes (API + Dexie)
 * without a backend round-trip, mirroring the other lesson preferences
 * (feedback intensity, keyboard shortcuts, swipe gestures).
 */

const KEY_ERRORS_ONLY = "adaptive-learner.lesson.error_replay_errors_only";

/** Default: replay only the wrong elements. */
export const DEFAULT_ERROR_REPLAY_ERRORS_ONLY = true;

/** Window event so hooks re-read live within the same tab (the native
 *  ``storage`` event only fires in OTHER tabs). */
export const ERROR_REPLAY_SCOPE_CHANGE_EVENT =
    "adaptive-learner:error-replay-scope-pref";

/** Read whether error-replay is scoped to only the wrong elements. Falls
 *  back to {@link DEFAULT_ERROR_REPLAY_ERRORS_ONLY} when unset/unreadable. */
export function readErrorReplayErrorsOnly(): boolean {
    try {
        const raw = localStorage.getItem(KEY_ERRORS_ONLY);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* no-op */
    }
    return DEFAULT_ERROR_REPLAY_ERRORS_ONLY;
}

/** Persist the error-replay scope preference and dispatch
 *  {@link ERROR_REPLAY_SCOPE_CHANGE_EVENT} so hooks re-read live in the same
 *  tab. Storage / dispatch failures are swallowed. */
export function setErrorReplayErrorsOnly(errorsOnly: boolean): void {
    try {
        localStorage.setItem(KEY_ERRORS_ONLY, errorsOnly ? "true" : "false");
    } catch {
        /* no-op */
    }
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(ERROR_REPLAY_SCOPE_CHANGE_EVENT));
        }
    } catch {
        /* no-op */
    }
}
