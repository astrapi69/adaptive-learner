/**
 * Human-readable language names (Phase 60 / v1.44.0).
 *
 * Uses the platform ``Intl.DisplayNames`` so a French set shows
 * as "Französisch" when the app language is German, "French" when
 * English, etc. — no hand-maintained per-language name tables.
 * Falls back to the uppercased code when ``Intl.DisplayNames`` is
 * unavailable or doesn't know the code.
 */

const cache = new Map<string, Intl.DisplayNames | null>();

function resolver(displayLang: string): Intl.DisplayNames | null {
  if (cache.has(displayLang)) return cache.get(displayLang) ?? null;
  let instance: Intl.DisplayNames | null = null;
  try {
    if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
      instance = new Intl.DisplayNames([displayLang], { type: "language" });
    }
  } catch {
    instance = null;
  }
  cache.set(displayLang, instance);
  return instance;
}

/**
 * Display name for a BCP-47 language ``code`` in the UI language
 * ``displayLang``. ``languageDisplayName("fr", "de")`` -> "Französisch".
 */
export function languageDisplayName(code: string, displayLang: string): string {
  const base = (code || "").split("-")[0].toLowerCase();
  if (!base) return code;
  const instance = resolver(displayLang);
  if (instance) {
    try {
      const name = instance.of(base);
      if (name && name.toLowerCase() !== base) {
        // Capitalise the first letter (some locales lowercase it).
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    } catch {
      /* fall through to the uppercased code */
    }
  }
  return base.toUpperCase();
}

/** Test-only: clear the resolver cache between cases. */
export function _resetLanguageNameCache(): void {
  cache.clear();
}
