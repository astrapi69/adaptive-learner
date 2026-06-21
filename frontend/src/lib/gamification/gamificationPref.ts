/**
 * Gamification preferences (Phase 29D).
 *
 * Persists user-toggleable preferences in localStorage. These
 * are presentation-only flags that don't influence the XP /
 * badge / streak ALGORITHMS — they only gate the visibility of
 * toasts + the daily goal hint. The streak weekend-mode flag
 * lives in the backend ``user_streaks`` row because it changes
 * the streak walk; everything else is client-local.
 *
 * Defaults:
 *   - xp_notifications: ON
 *   - badge_notifications: ON
 *   - daily_session_goal: 1
 */

const KEY_XP_NOTIF = "adaptive-learner.gamification.xp_notifications";
const KEY_BADGE_NOTIF = "adaptive-learner.gamification.badge_notifications";
const KEY_DAILY_GOAL = "adaptive-learner.gamification.daily_session_goal";

export interface GamificationPrefs {
    xpNotifications: boolean;
    badgeNotifications: boolean;
    dailySessionGoal: number;
}

function readBool(key: string, fallback: boolean): boolean {
    try {
        const raw = localStorage.getItem(key);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* no-op */
    }
    return fallback;
}

function readNumber(key: string, fallback: number): number {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } catch {
        /* no-op */
    }
    return fallback;
}

/** Read all gamification preferences from localStorage, falling back to the defaults. */
export function readGamificationPrefs(): GamificationPrefs {
    return {
        xpNotifications: readBool(KEY_XP_NOTIF, true),
        badgeNotifications: readBool(KEY_BADGE_NOTIF, true),
        dailySessionGoal: readNumber(KEY_DAILY_GOAL, 1),
    };
}

/** Persist the XP-notification toggle to localStorage. */
export function setXpNotifications(enabled: boolean): void {
    try {
        localStorage.setItem(KEY_XP_NOTIF, enabled ? "true" : "false");
    } catch {
        /* no-op */
    }
}

/** Persist the badge-notification toggle to localStorage. */
export function setBadgeNotifications(enabled: boolean): void {
    try {
        localStorage.setItem(KEY_BADGE_NOTIF, enabled ? "true" : "false");
    } catch {
        /* no-op */
    }
}

/**
 * Persist the daily session goal to localStorage, clamped to
 * the 1-10 range.
 */
export function setDailySessionGoal(goal: number): void {
    try {
        const clamped = Math.max(1, Math.min(10, Math.floor(goal)));
        localStorage.setItem(KEY_DAILY_GOAL, String(clamped));
    } catch {
        /* no-op */
    }
}

export const GAMIFICATION_PREF_KEYS = {
    xpNotifications: KEY_XP_NOTIF,
    badgeNotifications: KEY_BADGE_NOTIF,
    dailySessionGoal: KEY_DAILY_GOAL,
} as const;
