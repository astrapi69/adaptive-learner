/**
 * Discover entry-point preset preference (EXP-048 #2331).
 *
 * Persists the learner's chosen entry point for "Inhalte entdecken" — the
 * task preset over the SAME list — under a single localStorage key, the same
 * lightweight UI-pref pattern as {@link discoverLanguagePref} (no Dexie table;
 * identical in Dexie and API mode).
 *
 * Values:
 *   - **null**          → no explicit choice yet; the caller falls back to the
 *                          default entry ("language"). Represented by an ABSENT
 *                          key.
 *   - **""**            → an explicit "Alles" choice (no entry filter).
 *   - **"language"**    → the "Sprache lernen" entry.
 *   - **"knowledge"**   → the "Fachgebiet" entry.
 *
 * The entry is a Vorbelegung, not a partition: an explicit choice (including
 * "") always wins over the default and persists across reloads, mirroring the
 * source-language preference (#1343). Pure read/write, no React imports.
 */

const KEY = "adaptive-learner.discover_entry";

export const DISCOVER_ENTRY_KEY = KEY;

export const DISCOVER_ENTRY_CHANGE_EVENT = "adaptive-learner:discover-entry-change";

/** The stored explicit choice, or ``null`` when the learner has not chosen one
 *  yet (→ caller uses the default entry). An empty string is a real "Alles"
 *  choice and is returned as ``""`` (not null). */
export function readDiscoverEntry(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Persist an explicit choice ("" = Alles) and notify this tab (the native
 *  ``storage`` event only fires in other tabs). */
export function writeDiscoverEntry(value: string): void {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* localStorage unavailable; no-op */
  }
  try {
    window.dispatchEvent(new Event(DISCOVER_ENTRY_CHANGE_EVENT));
  } catch {
    /* window unavailable (SSR / tests without jsdom) */
  }
}
