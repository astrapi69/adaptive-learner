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

/**
 * BCP-47 language (base) code -> ISO 3166-1 alpha-2 region whose flag stands in
 * for the language. A language is not a country, so this is a deliberate,
 * curated convention (English -> GB, Portuguese -> PT, ...), not an algorithm;
 * a code with no sensible single flag is simply absent and renders no flag.
 * Covers every language in the content catalogue plus all UI-catalogue codes.
 */
const LANGUAGE_REGION: Record<string, string> = {
  de: "DE", en: "GB", es: "ES", fr: "FR", it: "IT", pt: "PT",
  nl: "NL", pl: "PL", ru: "RU", uk: "UA", tr: "TR", el: "GR",
  sv: "SE", da: "DK", no: "NO", fi: "FI", cs: "CZ", sk: "SK",
  hu: "HU", ro: "RO", bg: "BG", hr: "HR", sr: "RS", sl: "SI",
  ja: "JP", ko: "KR", zh: "CN", hi: "IN", id: "ID", th: "TH",
  vi: "VN", ar: "SA", he: "IL", fa: "IR", ur: "PK", bn: "BD",
  ms: "MY", tl: "PH", sw: "KE", af: "ZA",
};

const REGIONAL_INDICATOR_A = 0x1f1e6;
const LATIN_A = "A".charCodeAt(0);

/** The emoji flag for a two-letter ISO 3166 region, or "" if malformed. */
function regionFlag(region: string): string {
  const cc = region.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(
    REGIONAL_INDICATOR_A + (cc.charCodeAt(0) - LATIN_A),
    REGIONAL_INDICATOR_A + (cc.charCodeAt(1) - LATIN_A),
  );
}

/**
 * Decorative flag emoji for a BCP-47 language ``code`` (region subtag stripped),
 * or "" when the language has no curated flag. Emoji-based, so no dependency and
 * no external asset (CSP-safe). Purely decorative: pair it with the language
 * NAME as the accessible text, never rely on the flag alone.
 * ``languageFlag("es")`` -> the Spanish flag; ``languageFlag("zz")`` -> "".
 */
export function languageFlag(code: string): string {
  const base = (code || "").split("-")[0].toLowerCase();
  const region = LANGUAGE_REGION[base];
  return region ? regionFlag(region) : "";
}

/**
 * The localised language name, prefixed with its flag when one exists (the
 * flag emoji, a space, then the name), or the bare name with NO leading space
 * when no flag is known. The name always carries the meaning; the flag is a
 * visual aid.
 */
export function flaggedName(code: string, displayLang: string): string {
  const name = languageDisplayName(code, displayLang);
  const flag = languageFlag(code);
  return flag ? `${flag} ${name}` : name;
}

/** Test-only: clear the resolver cache between cases. */
export function _resetLanguageNameCache(): void {
  cache.clear();
}
