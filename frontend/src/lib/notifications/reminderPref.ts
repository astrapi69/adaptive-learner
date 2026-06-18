/**
 * notifications/reminderPref — local, mode-agnostic preferences for the
 * daily learning-reminder feature (#723): whether reminders are on, the
 * time of day, and which weekdays. Plus an internal ``lastShownDate`` so a
 * reminder fires at most once per calendar day.
 *
 * Stored in localStorage (same pattern as ``hintPref``/``feedbackPref``),
 * with a change event so an open Settings surface and the scheduler react
 * live. Pure frontend — works in both storage modes, needs no backend.
 *
 * The due-decision logic lives in the pure ``reminder`` module; this file
 * only reads/writes the persisted shape.
 */

const KEY_ENABLED = "adaptive-learner.reminders.enabled";
const KEY_TIME = "adaptive-learner.reminders.time";
const KEY_WEEKDAYS = "adaptive-learner.reminders.weekdays";
const KEY_LAST_SHOWN = "adaptive-learner.reminders.last_shown";

/** Reminders are off until the learner opts in (and grants permission). */
export const DEFAULT_REMINDERS_ENABLED = false;
/** Default reminder time, 24h ``HH:MM``. */
export const DEFAULT_REMINDER_TIME = "19:00";
/** Default weekdays: all seven (0 = Sunday .. 6 = Saturday, JS getDay()). */
export const DEFAULT_REMINDER_WEEKDAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

export const REMINDER_PREF_CHANGE_EVENT = "adaptive-learner:reminder-pref";

/** The persisted reminder configuration (the user-editable part). */
export interface ReminderSettings {
    enabled: boolean;
    /** 24h ``HH:MM``. */
    time: string;
    /** JS getDay() values, 0 (Sun) .. 6 (Sat); de-duped + sorted. */
    weekdays: number[];
}

function notifyChange(): void {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(REMINDER_PREF_CHANGE_EVENT));
    }
}

/** True when ``value`` is a valid 24h ``HH:MM`` string. */
export function isValidTime(value: string): boolean {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return false;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/** Clamp an arbitrary list to valid, de-duped, sorted weekday numbers. */
export function clampWeekdays(values: readonly number[]): number[] {
    const valid = new Set<number>();
    for (const day of values) {
        if (Number.isInteger(day) && day >= 0 && day <= 6) valid.add(day);
    }
    return [...valid].sort((a, b) => a - b);
}

function readEnabled(): boolean {
    try {
        const raw = localStorage.getItem(KEY_ENABLED);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* no-op */
    }
    return DEFAULT_REMINDERS_ENABLED;
}

function readTime(): string {
    try {
        const raw = localStorage.getItem(KEY_TIME);
        if (raw !== null && isValidTime(raw)) return raw;
    } catch {
        /* no-op */
    }
    return DEFAULT_REMINDER_TIME;
}

function readWeekdays(): number[] {
    try {
        const raw = localStorage.getItem(KEY_WEEKDAYS);
        if (raw !== null && raw !== "") {
            const parsed = raw
                .split(",")
                .map((part) => Number(part.trim()))
                .filter((part) => Number.isFinite(part));
            const cleaned = clampWeekdays(parsed);
            if (cleaned.length > 0) return cleaned;
        }
    } catch {
        /* no-op */
    }
    return [...DEFAULT_REMINDER_WEEKDAYS];
}

/** Read the full reminder configuration, defaults filled in on any gap. */
export function readReminderSettings(): ReminderSettings {
    return {
        enabled: readEnabled(),
        time: readTime(),
        weekdays: readWeekdays(),
    };
}

export function setRemindersEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(KEY_ENABLED, enabled ? "true" : "false");
    } catch {
        /* no-op */
    }
    notifyChange();
}

export function setReminderTime(time: string): void {
    if (!isValidTime(time)) return;
    try {
        localStorage.setItem(KEY_TIME, time);
    } catch {
        /* no-op */
    }
    notifyChange();
}

export function setReminderWeekdays(weekdays: readonly number[]): void {
    try {
        localStorage.setItem(KEY_WEEKDAYS, clampWeekdays(weekdays).join(","));
    } catch {
        /* no-op */
    }
    notifyChange();
}

/**
 * The last calendar day (``YYYY-MM-DD``, local) a reminder was shown, or
 * ``null`` if never. Internal bookkeeping, not a user-facing setting.
 */
export function readLastShownDate(): string | null {
    try {
        return localStorage.getItem(KEY_LAST_SHOWN);
    } catch {
        return null;
    }
}

export function setLastShownDate(isoDate: string): void {
    try {
        localStorage.setItem(KEY_LAST_SHOWN, isoDate);
    } catch {
        /* no-op */
    }
}
