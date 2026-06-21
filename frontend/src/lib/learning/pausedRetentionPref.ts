/**
 * Paused-lesson retention preference (Phase 63F / EXP-020).
 *
 * Stores the number of days after which an untouched paused
 * lesson is automatically abandoned on the next Dashboard load.
 * ``0`` means "never abandon" (keep forever).
 *
 * A hard cap (``MAX_PAUSED``) limits the total number of paused
 * lessons retained regardless of age; excess entries (oldest
 * first) are abandoned before the dashboard renders.
 */

export const RETENTION_PREF_KEY =
    "adaptive-learner.paused_lessons_retention_days";

export const DEFAULT_RETENTION_DAYS = 30;

/** Maximum paused lessons kept regardless of age. */
export const MAX_PAUSED = 10;

/** Ordered options shown in the Settings control. */
export const RETENTION_OPTIONS: { days: number; labelKey: string; fallback: string }[] = [
    {days: 7,  labelKey: "settings.paused_retention.7_days",  fallback: "7 days"},
    {days: 14, labelKey: "settings.paused_retention.14_days", fallback: "14 days"},
    {days: 30, labelKey: "settings.paused_retention.30_days", fallback: "30 days"},
    {days: 60, labelKey: "settings.paused_retention.60_days", fallback: "60 days"},
    {days: 0,  labelKey: "settings.paused_retention.never",   fallback: "Never"},
];

/** The configured paused-lesson retention in days (``0`` = never
 *  abandon). Falls back to the default for a missing / negative /
 *  non-numeric value. */
export function readRetentionDays(): number {
    try {
        const raw = localStorage.getItem(RETENTION_PREF_KEY);
        if (raw === null) return DEFAULT_RETENTION_DAYS;
        const parsed = parseInt(raw, 10);
        return isNaN(parsed) || parsed < 0 ? DEFAULT_RETENTION_DAYS : parsed;
    } catch {
        return DEFAULT_RETENTION_DAYS;
    }
}

/** Persist the paused-lesson retention in days (best-effort; ignored
 *  when localStorage is unavailable). */
export function writeRetentionDays(days: number): void {
    try {
        localStorage.setItem(RETENTION_PREF_KEY, String(days));
    } catch {
        /* localStorage unavailable */
    }
}
