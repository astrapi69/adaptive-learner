/**
 * Lesson keyboard-shortcut preference (#103).
 *
 * Persists whether the Enter-key shortcut is active in the lesson
 * player. Presentation/input-only: it never changes grading, XP, or
 * progress — only whether Enter drives the Check / Next action.
 *
 * Stored in localStorage so it works identically in both storage
 * modes (API + Dexie) without a backend round-trip, mirroring the
 * other lesson preferences (feedback intensity, swipe gestures).
 */

const KEY_ENABLED = "adaptive-learner.lesson.shortcuts_enabled";

export const DEFAULT_LESSON_SHORTCUTS_ENABLED = true;

/** Window event so hooks re-read live within the same tab (the
 *  native ``storage`` event only fires in OTHER tabs). */
export const LESSON_SHORTCUTS_CHANGE_EVENT =
    "adaptive-learner:lesson-shortcuts-pref";

/** Read whether the lesson Enter-key shortcut is enabled. Falls back to
 *  {@link DEFAULT_LESSON_SHORTCUTS_ENABLED} when unset or unreadable. */
export function readLessonShortcutsEnabled(): boolean {
    try {
        const raw = localStorage.getItem(KEY_ENABLED);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* no-op */
    }
    return DEFAULT_LESSON_SHORTCUTS_ENABLED;
}

/** Persist the lesson Enter-key shortcut preference and dispatch
 *  {@link LESSON_SHORTCUTS_CHANGE_EVENT} so hooks re-read live in the
 *  same tab. Storage / dispatch failures are swallowed. */
export function setLessonShortcutsEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(KEY_ENABLED, enabled ? "true" : "false");
    } catch {
        /* no-op */
    }
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(LESSON_SHORTCUTS_CHANGE_EVENT));
        }
    } catch {
        /* no-op */
    }
}

/**
 * The lesson step state that decides what Enter does. Mirrors the
 * two-phase button state in ``Lesson.tsx``.
 */
export interface LessonEnterState {
    /** The summary screen (no Check/Next in the step footer). */
    isSummary: boolean;
    /** A gradable exercise step (vs theory / unsupported). */
    isExerciseStep: boolean;
    /** The answer has been graded; the button shows "Next". */
    checked: boolean;
    /** Entered on an already-completed step (locked / reviewed). */
    enteredReviewed: boolean;
    /** The exercise reports a checkable answer ("Check" enabled). */
    answerable: boolean;
}

export type LessonEnterAction = "check" | "next" | "none";

/**
 * Pure decision for what the Enter key should do on a lesson step:
 *
 * - unanswered exercise  -> ``"none"`` (Enter has no effect)
 * - answered, not checked -> ``"check"`` (the "Prüfen" action)
 * - checked / reviewed / theory step -> ``"next"`` (the "Weiter" action)
 * - summary screen -> ``"none"`` (it has its own actions)
 */
export function decideLessonEnterAction(
    state: LessonEnterState,
): LessonEnterAction {
    if (state.isSummary) return "none";
    if (state.isExerciseStep && !state.checked && !state.enteredReviewed) {
        return state.answerable ? "check" : "none";
    }
    return "next";
}
