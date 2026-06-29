/**
 * Info-hint preference (#1251) — persistence for the fading-blink onboarding
 * hint behind the ContentHub info button.
 *
 * Two facts are tracked per hint id (one id per tab, e.g. ``content_my`` /
 * ``content_discover``): whether the user has ever opened the hint (``seen``)
 * and how many times the tab has been visited (``visits``). Together they drive
 * the "blink for the first few visits, then never again" behaviour:
 *   - clicked once -> ``seen`` -> never blink again;
 *   - visited {@link INFO_BLINK_MAX_VISITS} times without a click -> stop.
 *
 * Stored as a single JSON value per id under the established
 * ``adaptive-learner.*`` localStorage namespace — the same lightweight UI-pref
 * mechanism the app already uses for ``content_view_mode`` /
 * ``sourceLanguagePref`` / ``useButtonTooltips``. Library-grade: pure
 * read/write, no React imports, fails closed on any storage error.
 */

/** Persisted per-hint state. */
export interface InfoHintState {
  /** The user has opened the hint at least once (-> never blink again). */
  seen: boolean;
  /** How many times the tab carrying the hint has been visited. */
  visits: number;
}

/**
 * Number of visits the button keeps blinking for, while still unseen. After
 * this many visits without a click the blink bows out for good (the user is
 * deliberately ignoring it; more blinking would only annoy). A click stops it
 * sooner. Chosen at 4 — comfortably inside the "after 3–4 visits" intent.
 */
export const INFO_BLINK_MAX_VISITS = 4;

const PREFIX = "adaptive-learner.info_hint.";

/** The localStorage key for a given hint id. */
export function infoHintKey(id: string): string {
  return PREFIX + id;
}

const DEFAULT_STATE: InfoHintState = { seen: false, visits: 0 };

/** Read the stored hint state. Returns the default on a missing/corrupt value
 *  or any storage error. */
export function readInfoHint(id: string): InfoHintState {
  try {
    const raw = localStorage.getItem(infoHintKey(id));
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<InfoHintState>;
    return {
      seen: parsed.seen === true,
      visits:
        typeof parsed.visits === "number" && parsed.visits >= 0
          ? Math.floor(parsed.visits)
          : 0,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/** Persist the hint state. No-op on any storage error. */
export function writeInfoHint(id: string, state: InfoHintState): void {
  try {
    localStorage.setItem(infoHintKey(id), JSON.stringify(state));
  } catch {
    /* localStorage unavailable; no-op */
  }
}
