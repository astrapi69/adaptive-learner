/**
 * Playful-mode (Spielmodus) preference (#2844).
 *
 * One learner-facing switch, persisted in localStorage (the same
 * pattern as {@link ./lessonModePref}): when ON, lessons celebrate
 * like a game — the effective feedback intensity is raised to
 * "enthusiastic" (praise on every correct answer, confetti,
 * milestone overlays; see ``feedbackPref.effectiveIntensity``) and
 * exercise renderers can read the ``playful`` flag off the lesson-mode
 * config to opt into playful presentation.
 *
 * Orthogonal to the seven lesson modes: a playful exam, a playful
 * timed run. Presentation-only — scoring, XP and SRS never change.
 * ``prefers-reduced-motion`` stays authoritative and keeps feedback
 * subtle even in playful mode.
 *
 * The lesson-start hint flag tracks whether the one-time "try the
 * game mode" banner in the lesson player was dismissed.
 */

const MODE_KEY = "adaptive-learner.lesson.playful_mode";
const HINT_DISMISSED_KEY = "adaptive-learner.lesson.playful_mode_hint_dismissed";

export const DEFAULT_PLAYFUL_MODE = false;

/** Dispatched on the window when the playful-mode preference changes in
 *  THIS tab (the native ``storage`` event only fires in other tabs). */
export const PLAYFUL_MODE_CHANGE_EVENT = "adaptive-learner:playful-mode-pref";

/** Whether playful mode is on, falling back to OFF when unset/invalid. */
export function readPlayfulMode(): boolean {
    try {
        return localStorage.getItem(MODE_KEY) === "true";
    } catch {
        return DEFAULT_PLAYFUL_MODE;
    }
}

/** Persist the playful-mode flag + dispatch the change event. */
export function setPlayfulMode(on: boolean): void {
    try {
        localStorage.setItem(MODE_KEY, on ? "true" : "false");
    } catch {
        /* no-op: storage unavailable */
    }
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(PLAYFUL_MODE_CHANGE_EVENT));
        }
    } catch {
        /* no-op */
    }
}

/** Whether the lesson-start playful-mode hint was dismissed. */
export function readPlayfulHintDismissed(): boolean {
    try {
        return localStorage.getItem(HINT_DISMISSED_KEY) === "true";
    } catch {
        return false;
    }
}

/** Persist the hint dismissal so the lesson-start banner stays gone. */
export function dismissPlayfulHint(): void {
    try {
        localStorage.setItem(HINT_DISMISSED_KEY, "true");
    } catch {
        /* no-op: storage unavailable */
    }
}
