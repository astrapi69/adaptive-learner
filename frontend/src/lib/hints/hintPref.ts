/**
 * hints/hintPref — local, mode-agnostic preferences for the exercise
 * hint system (#590): whether hints are offered, and the XP cost shown
 * per hint. Stored in localStorage (same pattern as feedbackPref), with
 * a change event so open surfaces react live.
 */

const KEY_ENABLED = "adaptive-learner.hints.enabled";
const KEY_XP_COST = "adaptive-learner.hints.xp_cost";

export const DEFAULT_HINTS_ENABLED = true;
export const DEFAULT_HINT_XP_COST = 5;
/** Upper bound for the configurable per-hint XP cost. */
export const MAX_HINT_XP_COST = 50;

export const HINT_PREF_CHANGE_EVENT = "adaptive-learner:hint-pref";

function notifyChange(): void {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(HINT_PREF_CHANGE_EVENT));
    }
}

/** Whether hints are offered during exercises (default on). */
export function readHintsEnabled(): boolean {
    try {
        const raw = localStorage.getItem(KEY_ENABLED);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* no-op */
    }
    return DEFAULT_HINTS_ENABLED;
}

/** Persist whether hints are offered and notify open surfaces. */
export function setHintsEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(KEY_ENABLED, enabled ? "true" : "false");
    } catch {
        /* no-op */
    }
    notifyChange();
}

/** Clamp an arbitrary number to a valid XP cost (0..MAX, integer). */
export function clampHintXpCost(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_HINT_XP_COST;
    return Math.min(MAX_HINT_XP_COST, Math.max(0, Math.round(value)));
}

/** The XP cost shown per revealed hint (default 5). */
export function readHintXpCost(): number {
    try {
        const raw = localStorage.getItem(KEY_XP_COST);
        if (raw !== null) {
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) return clampHintXpCost(parsed);
        }
    } catch {
        /* no-op */
    }
    return DEFAULT_HINT_XP_COST;
}

/** Persist the per-hint XP cost (clamped to 0..MAX) and notify open
 *  surfaces. */
export function setHintXpCost(value: number): void {
    try {
        localStorage.setItem(KEY_XP_COST, String(clampHintXpCost(value)));
    } catch {
        /* no-op */
    }
    notifyChange();
}
