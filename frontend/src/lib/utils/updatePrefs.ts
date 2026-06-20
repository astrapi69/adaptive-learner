/**
 * Desktop update-checker preferences (#840), persisted in localStorage.
 *
 * Device-local UI config (like Developer Mode / feedback intensity /
 * max-lesson-size), NOT learner content — so it lives in localStorage, not
 * the synced settings model. Only consumed in API/desktop mode; the
 * Dexie/PWA path never reads it.
 */

/** How often the silent app-start check runs. */
export type UpdateInterval = "daily" | "weekly" | "monthly" | "never";

/** The stored update preferences. */
export interface UpdatePrefs {
  /** Run the silent app-start check at all. */
  auto_check: boolean;
  /** Minimum spacing between silent checks. */
  check_interval: UpdateInterval;
  /** ISO timestamp of the last check, or null when never checked. */
  last_check_at: string | null;
  /** A version the user dismissed (banner stays hidden until a newer one). */
  dismissed_version: string | null;
}

const STORAGE_KEY = "adaptive-learner.updates";

export const DEFAULT_UPDATE_PREFS: UpdatePrefs = {
  auto_check: true,
  check_interval: "daily",
  last_check_at: null,
  dismissed_version: null,
};

/** Interval length in ms; ``never`` is Infinity (a check is never due). */
export const UPDATE_INTERVALS: Record<UpdateInterval, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  never: Infinity,
};

function isInterval(value: unknown): value is UpdateInterval {
  return value === "daily" || value === "weekly" || value === "monthly" || value === "never";
}

/** Read the prefs, merging stored values over the defaults (never throws). */
export function readUpdatePrefs(): UpdatePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_UPDATE_PREFS };
    const parsed = JSON.parse(raw) as Partial<UpdatePrefs>;
    return {
      auto_check:
        typeof parsed.auto_check === "boolean"
          ? parsed.auto_check
          : DEFAULT_UPDATE_PREFS.auto_check,
      check_interval: isInterval(parsed.check_interval)
        ? parsed.check_interval
        : DEFAULT_UPDATE_PREFS.check_interval,
      last_check_at:
        typeof parsed.last_check_at === "string" ? parsed.last_check_at : null,
      dismissed_version:
        typeof parsed.dismissed_version === "string" ? parsed.dismissed_version : null,
    };
  } catch {
    return { ...DEFAULT_UPDATE_PREFS };
  }
}

/** Merge a patch into the stored prefs and persist; returns the result. */
export function writeUpdatePrefs(patch: Partial<UpdatePrefs>): UpdatePrefs {
  const next = { ...readUpdatePrefs(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage unavailable (private mode) — non-fatal */
  }
  return next;
}

/**
 * Whether a silent check is due: auto-check on, interval not ``never``, and
 * the interval has elapsed since ``last_check_at`` (or it was never run).
 *
 * @param prefs - The current prefs.
 * @param now - Current epoch ms (injectable for tests).
 */
export function isCheckDue(prefs: UpdatePrefs, now: number = Date.now()): boolean {
  if (!prefs.auto_check) return false;
  const interval = UPDATE_INTERVALS[prefs.check_interval];
  if (!Number.isFinite(interval)) return false;
  if (!prefs.last_check_at) return true;
  const last = Date.parse(prefs.last_check_at);
  if (Number.isNaN(last)) return true;
  return now - last >= interval;
}
