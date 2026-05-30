/**
 * Additional source-languages preference (Phase 60 / v1.44.0).
 *
 * The Content Browser's PRIMARY source language is always the
 * learner's app language (Settings > Language). This preference
 * lets advanced multilingual users mark EXTRA languages they
 * also speak ("Ich spreche auch Englisch") so content authored
 * for those source languages surfaces in the primary tree
 * instead of the collapsed "other source languages" section.
 *
 * Persisted as a JSON array of base BCP-47 codes in localStorage.
 * Empty by default. A custom event lets the Content page re-read
 * live when the Settings control changes the value in the same
 * tab; the native ``storage`` event covers other tabs.
 */

const KEY = "adaptive-learner.source_languages";

export const SOURCE_LANGUAGES_CHANGE_EVENT = "adaptive-learner:source-languages-change";

/** Read the opted-in additional source languages (base subtags,
 *  deduped, lowercased). Returns [] on any parse / storage error. */
export function readAdditionalSourceLanguages(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const codes = parsed
      .filter((x): x is string => typeof x === "string")
      .map((c) => c.split("-")[0].toLowerCase())
      .filter((c) => c.length >= 2);
    return [...new Set(codes)];
  } catch {
    return [];
  }
}

/** Persist the additional source languages and notify listeners
 *  in this tab (the ``storage`` event only fires in other tabs). */
export function writeAdditionalSourceLanguages(codes: string[]): void {
  const normalised = [
    ...new Set(codes.map((c) => c.split("-")[0].toLowerCase())),
  ];
  try {
    localStorage.setItem(KEY, JSON.stringify(normalised));
  } catch {
    /* localStorage unavailable; no-op */
  }
  try {
    window.dispatchEvent(new Event(SOURCE_LANGUAGES_CHANGE_EVENT));
  } catch {
    /* window unavailable (SSR / tests without jsdom) */
  }
}

export const SOURCE_LANGUAGES_KEY = KEY;
