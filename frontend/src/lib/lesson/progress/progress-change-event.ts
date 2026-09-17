/**
 * Same-tab change signal for lesson progress rows (#3075).
 *
 * A lesson left by in-app navigation is paused in the unmount of the
 * lesson page, and the dashboard that replaces it reads the progress
 * rows in its own mount, in the SAME commit. No wait orders those two:
 * the read can observe the row from before the pause and never look
 * again. So the writer announces every landed write, and the readers
 * that show progress (paused lessons, "continue learning") re-read on
 * the announcement instead of trusting their mount-time snapshot.
 * Mirrors ``ASSESSMENT_PROGRESS_CHANGE_EVENT`` (#106).
 */

/** Window event dispatched after every lesson-progress write lands. */
export const LESSON_PROGRESS_CHANGE_EVENT = "adaptive-learner:lesson-progress";

/** Announce that a lesson-progress row was written. Never throws. */
export function notifyLessonProgressChanged(): void {
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(LESSON_PROGRESS_CHANGE_EVENT));
        }
    } catch {
        /* no-op: a listener-less or windowless environment has nobody to tell */
    }
}

/**
 * Subscribe to lesson-progress writes; returns the unsubscribe function.
 *
 * @example
 * useEffect(() => subscribeLessonProgressChanged(() => setTick((t) => t + 1)), []);
 */
export function subscribeLessonProgressChanged(listener: () => void): () => void {
    if (typeof window === "undefined") return () => undefined;
    window.addEventListener(LESSON_PROGRESS_CHANGE_EVENT, listener);
    return () => window.removeEventListener(LESSON_PROGRESS_CHANGE_EVENT, listener);
}
