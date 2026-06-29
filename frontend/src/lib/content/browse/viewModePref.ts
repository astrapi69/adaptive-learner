/**
 * Content-view-mode preference (grid ⇄ list, #1240).
 *
 * The /content browser can render either the rich source→target→level
 * tree ("grid"/Kacheln, the default — no break for existing users) or a
 * compact flat list ("list"/Liste, opt-in, fast to scroll on mobile).
 *
 * Persisted under a single key in localStorage — the same lightweight
 * UI-pref pattern the app already uses for ``sourceLanguagePref`` and
 * ``useButtonTooltips``. A custom event lets the Content page re-read
 * live when the toggle flips in this tab; the native ``storage`` event
 * covers other tabs. Library-grade: pure read/write, no React imports.
 */

export type ContentViewMode = "grid" | "list";

const KEY = "adaptive-learner.content_view_mode";

export const CONTENT_VIEW_MODE_KEY = KEY;

export const CONTENT_VIEW_MODE_CHANGE_EVENT = "adaptive-learner:content-view-mode-change";

/** Read the stored view mode. Defaults to "grid" (the tree view) on a
 *  missing/unrecognised value or any storage error. */
export function readContentViewMode(): ContentViewMode {
  try {
    return localStorage.getItem(KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

/** Persist the view mode and notify listeners in this tab (the native
 *  ``storage`` event only fires in other tabs). */
export function writeContentViewMode(mode: ContentViewMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* localStorage unavailable; no-op */
  }
  try {
    window.dispatchEvent(new Event(CONTENT_VIEW_MODE_CHANGE_EVENT));
  } catch {
    /* window unavailable (SSR / tests without jsdom) */
  }
}
