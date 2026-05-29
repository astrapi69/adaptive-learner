/**
 * Haptic feedback helper (EXP-008 / Phase 55B).
 *
 * Mirrors the swipe-gesture haptic (``useSwipe.hapticSwipe``):
 * a single short vibration pulse, no-op on platforms without the
 * Vibration API, fail-safe (never throws). Used for the
 * correct-answer micro-feedback.
 */

/** Fire a short vibration pulse (default 10ms). No-op when the
 *  Vibration API is unavailable. */
export function fireHaptic(ms = 10): void {
    if (
        typeof navigator !== "undefined" &&
        typeof navigator.vibrate === "function"
    ) {
        try {
            navigator.vibrate(ms);
        } catch {
            /* ignore */
        }
    }
}
