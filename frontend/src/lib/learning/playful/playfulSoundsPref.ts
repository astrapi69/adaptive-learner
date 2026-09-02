/**
 * Game-mode sound preference (#2875).
 *
 * A second, independent opt-in beside the global sounds switch:
 * while GAME MODE is on and this flag is on, the celebration
 * sounds play even though the global switch is off - the game
 * mode brings its own soundtrack (rising-pitch correct tone,
 * checkpoint jingle, completion fanfare). The global switch keeps
 * working unchanged; volume always follows the existing slider.
 *
 * The ``prompted`` flag remembers that the one-time "play with
 * sound?" offer was answered (either way), so the user is never
 * asked twice. Same localStorage pattern as
 * {@link ./playfulModePref}.
 */

import {readPlayfulMode} from "./playfulModePref";

const SOUNDS_KEY = "adaptive-learner.lesson.playful_sounds";
const PROMPTED_KEY = "adaptive-learner.lesson.playful_sounds_prompted";

/** Dispatched on the window when the preference changes in THIS tab. */
export const PLAYFUL_SOUNDS_CHANGE_EVENT =
    "adaptive-learner:playful-sounds-pref";

/** Whether game-mode sounds are on, falling back to OFF. */
export function readPlayfulSounds(): boolean {
    try {
        return localStorage.getItem(SOUNDS_KEY) === "true";
    } catch {
        return false;
    }
}

/** Persist the game-mode sound flag + dispatch the change event.
 *  Any explicit choice also answers the one-time offer. */
export function setPlayfulSounds(on: boolean): void {
    try {
        localStorage.setItem(SOUNDS_KEY, on ? "true" : "false");
        localStorage.setItem(PROMPTED_KEY, "true");
    } catch {
        /* no-op: storage unavailable */
    }
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(PLAYFUL_SOUNDS_CHANGE_EVENT));
        }
    } catch {
        /* no-op */
    }
}

/** Whether the one-time sound offer was already answered. */
export function readPlayfulSoundsPrompted(): boolean {
    try {
        return localStorage.getItem(PROMPTED_KEY) === "true";
    } catch {
        return true;
    }
}

/** Dismiss the one-time offer without turning sounds on ("later"). */
export function markPlayfulSoundsPrompted(): void {
    try {
        localStorage.setItem(PROMPTED_KEY, "true");
    } catch {
        /* no-op */
    }
}

/** The game-mode sound gate: game mode on AND its sound flag on. */
export function playfulSoundsActive(): boolean {
    return readPlayfulMode() && readPlayfulSounds();
}
