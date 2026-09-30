/**
 * "Keep the screen on in lessons" preference (#3358).
 *
 * While on, a lesson (and every runner mode) holds a screen wake lock
 * while it is open and not on its summary, so the display does not turn
 * off during silent reading. Default ON (owner decision on #3358); the
 * toggle lives in Settings > Learning > Interaction, per the rule that a
 * behaviour-changing default is visible.
 *
 * Stored in localStorage so it works identically in both storage modes,
 * mirroring the other lesson preferences (lesson shortcuts, Ask AI).
 */

const KEY = "adaptive-learner.lesson.keep_screen_on";

export const DEFAULT_KEEP_SCREEN_ON = true;

/** Read the preference; {@link DEFAULT_KEEP_SCREEN_ON} when unset or
 *  unreadable. */
export function readKeepScreenOn(): boolean {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* no-op */
    }
    return DEFAULT_KEEP_SCREEN_ON;
}

/** Persist the preference. Storage failures are swallowed. */
export function setKeepScreenOn(on: boolean): void {
    try {
        localStorage.setItem(KEY, on ? "true" : "false");
    } catch {
        /* no-op */
    }
}
