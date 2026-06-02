/**
 * Best-effort detection of the LEARNING (target) language of an imported
 * chat transcript (v1.54.0 — languages at import time).
 *
 * A learning chat is mostly written in the language the learner SPEAKS
 * (the app language) with examples in the language they LEARN. So the
 * target is the supported language OTHER than the app language whose
 * signal words / script appear in the transcript. When no foreign signal
 * is present the chat is domain content in the app language itself
 * (e.g. German grammar explained in German) -> the app language is
 * returned as the target so source == target is surfaced (the domain
 * path allows it). Returns null only when there is nothing to go on.
 *
 * Pure + deterministic; scans a generous leading window of the text.
 * The caller (the import page) pre-fills the "Lernsprache" dropdown with
 * the result and the user can always override it.
 */

/** Non-Latin scripts are unambiguous: their presence is strong evidence
 *  of that language being in play. */
const SCRIPT_RANGES: { lang: string; re: RegExp }[] = [
  { lang: "el", re: /[Ͱ-Ͽἀ-῿]/ }, // Greek
  { lang: "ja", re: /[぀-ヿ一-鿿]/ }, // Kana + Kanji
  { lang: "ru", re: /[Ѐ-ӿ]/ }, // Cyrillic
  { lang: "ar", re: /[؀-ۿ]/ }, // Arabic
  { lang: "ko", re: /[가-힯]/ }, // Hangul
];

/** Latin-script signal words / markers per language. Lowercased; matched
 *  with word boundaries (markers like ñ/¿ are matched raw). Kept small
 *  and high-signal to avoid false positives from incidental words. */
const KEYWORDS: { lang: string; words: string[]; markers?: RegExp }[] = [
  {
    lang: "fr",
    words: ["bonjour", "merci", "passé", "passe composé", "être", "avoir", "voilà", "oui", "français", "aujourd'hui", "c'est"],
    markers: /ç/,
  },
  {
    lang: "es",
    words: ["hola", "gracias", "pretérito", "ser", "estar", "español", "buenos días", "por favor", "usted"],
    markers: /[ñ¿¡]/,
  },
  {
    lang: "it",
    words: ["ciao", "grazie", "sono", "italiano", "buongiorno", "perché", "anche"],
  },
  {
    lang: "pt",
    words: ["olá", "obrigado", "obrigada", "português", "você", "está", "bom dia"],
  },
  {
    lang: "de",
    words: ["hallo", "danke", "deutsch", "ich bin", "bitte", "und", "nicht", "guten tag"],
    markers: /[äöüß]/,
  },
  {
    lang: "en",
    words: ["hello", "thank you", "english", "the", "you are", "please", "good morning"],
  },
  {
    lang: "tr",
    words: ["merhaba", "teşekkür", "türkçe", "evet", "günaydın", "lütfen"],
    markers: /[ığşİ]/,
  },
];

function base(code: string | null | undefined): string {
  return (code || "").split("-")[0].toLowerCase();
}

function countHits(haystack: string, entry: (typeof KEYWORDS)[number]): number {
  let hits = 0;
  for (const word of entry.words) {
    // Escape regex metachars; match on word boundaries where the word is
    // alphabetic (apostrophes/spaces handled by a looser contains check).
    if (/[^a-zà-ÿ]/.test(word)) {
      if (haystack.includes(word)) hits += 1;
    } else {
      const re = new RegExp(`\\b${word}\\b`, "u");
      if (re.test(haystack)) hits += 1;
    }
  }
  if (entry.markers && entry.markers.test(haystack)) hits += 1;
  return hits;
}

/**
 * Detect the learning (target) language. ``appLang`` is the language the
 * learner speaks (the source / chat language), used to prefer a foreign
 * target over the prose language.
 *
 * - A non-Latin script different from the app language wins outright.
 * - Otherwise the Latin language (other than ``appLang``) with the most
 *   signal hits (>= the threshold) wins.
 * - If only the app language shows signals (or nothing foreign is
 *   present), the app language is returned (domain content).
 * - ``null`` when the text is empty / has no usable signal.
 */
export function detectLearningLanguage(
  text: string | null | undefined,
  appLang: string,
): string | null {
  const app = base(appLang);
  if (!text || !text.trim()) return null;
  const sample = text.slice(0, 4000);
  const lower = sample.toLowerCase();

  for (const { lang, re } of SCRIPT_RANGES) {
    if (lang !== app && re.test(sample)) return lang;
  }

  let best: string | null = null;
  let bestHits = 0;
  for (const entry of KEYWORDS) {
    if (entry.lang === app) continue;
    const hits = countHits(lower, entry);
    if (hits > bestHits) {
      best = entry.lang;
      bestHits = hits;
    }
  }

  // A foreign language needs at least 2 distinct signals to win over the
  // prose language (one stray word is not enough). Otherwise the chat is
  // taken to be in the app language itself (domain content) — the user
  // can always override the pre-filled dropdown.
  if (best && bestHits >= 2) return best;
  return app;
}
