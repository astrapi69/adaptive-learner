/**
 * Content-view-mode preference (grid ⇄ list, #1240 + #1257).
 *
 * The GLOBAL view preference for every content tab: the browser can
 * render either the rich source→target→level tree ("grid"/Kacheln) or a
 * compact flat list ("list"/Liste, fast to scroll on mobile).
 *
 * #1257 — the default is now **list**. This deliberately reverses #1240's
 * grid default; existing users keep their explicit choice (migration: a
 * stored "grid" still reads back as grid), only new/unset users default
 * to list.
 *
 * Persisted under a single key in localStorage — the same lightweight
 * UI-pref pattern the app already uses for ``sourceLanguagePref`` and
 * ``useButtonTooltips``. It is the single source for BOTH the in-tab
 * quick-toggle and the Settings control. A custom event lets every
 * consumer re-read live when the value flips in this tab; the native
 * ``storage`` event covers other tabs. Library-grade: pure read/write,
 * no React imports.
 */

export type ContentViewMode = "grid" | "list";

const KEY = "adaptive-learner.content_view_mode";

export const CONTENT_VIEW_MODE_KEY = KEY;

export const CONTENT_VIEW_MODE_CHANGE_EVENT = "adaptive-learner:content-view-mode-change";

/** Read the stored view mode. Defaults to "list" (#1257) on a
 *  missing/unrecognised value or any storage error. An explicit "grid"
 *  is preserved (existing-user migration), so only new/unset users get
 *  the new list default. */
export function readContentViewMode(): ContentViewMode {
  try {
    return localStorage.getItem(KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
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
