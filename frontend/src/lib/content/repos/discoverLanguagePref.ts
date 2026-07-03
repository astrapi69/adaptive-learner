/**
 * Discover source-language filter preference (#1343).
 *
 * Persists the learner's EXPLICIT source-language choice for "Inhalte
 * entdecken" under a single localStorage key — the same lightweight UI-pref
 * pattern the app already uses for ``viewModePref`` / ``sourceLanguagePref``
 * (no Dexie table; identical in Dexie and API mode).
 *
 * Three states, deliberately distinct:
 *   - **null**  → no explicit choice yet; the caller falls back to the
 *                 UI-locale default (and re-derives it when the locale
 *                 changes). Represented by an ABSENT key.
 *   - **""**    → an explicit "All languages" choice (shows every set).
 *                 Represented by a stored EMPTY string — distinct from null,
 *                 so it wins over the locale default like any other choice.
 *   - **"de"…** → an explicit BCP-47 source language.
 *
 * An explicit choice (including "") always wins over the locale default,
 * mirroring theme/UI-language: an explicit choice is never overwritten.
 * A custom event lets same-tab consumers re-read live; the native
 * ``storage`` event covers other tabs. Pure read/write, no React imports.
 */

const KEY = "adaptive-learner.discover_source_language";

export const DISCOVER_SOURCE_LANGUAGE_KEY = KEY;

export const DISCOVER_SOURCE_LANGUAGE_CHANGE_EVENT =
  "adaptive-learner:discover-source-language-change";

/**
 * The stored explicit choice, or ``null`` when the learner has not chosen
 * one yet (→ caller uses the UI-locale default). An empty string is a
 * real "All languages" choice and is returned as ``""`` (not null).
 */
export function readDiscoverSourceLanguage(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Persist an explicit choice ("" = all languages) and notify this tab
 *  (the native ``storage`` event only fires in other tabs). */
export function writeDiscoverSourceLanguage(value: string): void {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* localStorage unavailable; no-op */
  }
  try {
    window.dispatchEvent(new Event(DISCOVER_SOURCE_LANGUAGE_CHANGE_EVENT));
  } catch {
    /* window unavailable (SSR / tests without jsdom) */
  }
}
