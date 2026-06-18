/**
 * notifications/reminder — pure scheduling logic for the daily
 * learning-reminder feature (#723). No DOM, no storage, no clock of its
 * own: every input (now, settings, last-shown date) is passed in, so the
 * whole decision is deterministic and unit-testable.
 *
 * Scope is FOREGROUND scheduling only (the app must be open) — reliable
 * background delivery for a closed PWA needs the Push API + a push
 * server, which is deliberately out of scope ("no server"). See #723.
 */

import type {ReminderSettings} from "./reminderPref";

/** Local calendar day as ``YYYY-MM-DD`` (not UTC — reminders are local). */
export function localDateKey(now: Date): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/** Minutes since local midnight for a ``HH:MM`` string, or null if invalid. */
function timeToMinutes(time: string): number | null {
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Whether today's reminder slot is active and not yet consumed.
 *
 * True when ALL hold:
 *  - reminders are enabled;
 *  - today's weekday (``now.getDay()``) is in the configured set;
 *  - the configured time-of-day has been reached or passed today;
 *  - no reminder has been shown yet today (``lastShownDate`` differs from
 *    today's local date key).
 *
 * The caller is responsible for consuming the slot (persisting today's
 * date via ``setLastShownDate``) so it fires at most once per day.
 *
 * @param settings - the persisted reminder configuration.
 * @param now - the current local time.
 * @param lastShownDate - ``YYYY-MM-DD`` of the last shown reminder, or null.
 */
export function isReminderDue(
    settings: ReminderSettings,
    now: Date,
    lastShownDate: string | null,
): boolean {
    if (!settings.enabled) return false;
    if (!settings.weekdays.includes(now.getDay())) return false;

    const target = timeToMinutes(settings.time);
    if (target === null) return false;
    const current = now.getHours() * 60 + now.getMinutes();
    if (current < target) return false;

    return lastShownDate !== localDateKey(now);
}
