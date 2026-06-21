/**
 * Swipe-gesture preference (Phase 23E).
 *
 * Persists a boolean on/off in localStorage. Default:
 *   - mobile-likely (touch-capable, ``navigator.maxTouchPoints > 0``): ON
 *   - everything else: OFF
 *
 * Settings UI flips the value; Assessment / Curriculum / Session
 * read it via ``readGesturePref()`` and pass it to ``useSwipe``
 * as the ``enabled`` flag.
 *
 * The hint-shown flag is a separate single-shot persistence so
 * the "swipe to navigate" hint never re-appears once a user has
 * either dismissed it or swiped successfully once.
 */

const KEY_ENABLED = "adaptive-learner.gestures_enabled";
const KEY_HINT_SHOWN = "adaptive-learner.gestures_hint_shown";

function detectTouchCapable(): boolean {
    if (typeof navigator === "undefined") return false;
    if (typeof navigator.maxTouchPoints === "number") {
        return navigator.maxTouchPoints > 0;
    }
    if (typeof window !== "undefined" && "ontouchstart" in window) {
        return true;
    }
    return false;
}

/**
 * Read the swipe-gesture on/off preference. Falls back to
 * touch-capability detection (ON for touch devices, OFF
 * otherwise) when no value is stored.
 */
export function readGesturePref(): boolean {
    try {
        const raw = localStorage.getItem(KEY_ENABLED);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* localStorage unavailable; fall through to default */
    }
    return detectTouchCapable();
}

/** Persist the swipe-gesture on/off preference to localStorage. */
export function writeGesturePref(enabled: boolean): void {
    try {
        localStorage.setItem(KEY_ENABLED, enabled ? "true" : "false");
    } catch {
        /* no-op */
    }
}

/** True once the "swipe to navigate" hint has been shown and recorded. */
export function readGestureHintShown(): boolean {
    try {
        return localStorage.getItem(KEY_HINT_SHOWN) === "true";
    } catch {
        return false;
    }
}

/** Record that the "swipe to navigate" hint has been shown, so it never re-appears. */
export function markGestureHintShown(): void {
    try {
        localStorage.setItem(KEY_HINT_SHOWN, "true");
    } catch {
        /* no-op */
    }
}

export const GESTURE_PREF_KEYS = {
    enabled: KEY_ENABLED,
    hintShown: KEY_HINT_SHOWN,
} as const;
