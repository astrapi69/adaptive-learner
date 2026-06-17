/**
 * Text normalisation helpers for the content-quality checks
 * (EXP-032). Pure, language-agnostic, no app imports.
 */

/** Base language code (``es-MX`` -> ``es``), lowercased. */
export function baseLang(code: string | null | undefined): string {
  return (code ?? "").split("-")[0].toLowerCase();
}

/**
 * Strip combining diacritics, keeping the base letters (``café`` ->
 * ``cafe``, ``está`` -> ``esta``, ``über`` -> ``uber``). Does NOT expand
 * German digraphs — the accent check needs the bare base letter, not the
 * ``ue``/``oe`` transliteration. ``ß`` has no NFD decomposition and is
 * left as-is.
 */
export function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Lowercase + strip diacritics — the comparison key for accent/article
 *  dictionary lookups. */
export function foldToken(token: string): string {
  return stripDiacritics(token.toLowerCase());
}

/**
 * Split a text into word tokens (runs of Unicode letters, apostrophes
 * stripped to handle French elision like ``l'eau``). Punctuation and
 * digits split. Returns the original-case tokens in order.
 */
export function wordTokens(text: string): string[] {
  if (!text) return [];
  return text
    .replace(/['’]/g, " ")
    .split(/[^\p{L}]+/u)
    .filter((tok) => tok.length > 0);
}

/**
 * Normalise a whole card field for duplicate comparison: lowercase,
 * expand German digraphs, NFD-fold remaining diacritics, collapse to
 * single spaces. Mirrors the content-search normaliser so "Begrüßung"
 * and "Begruessung" collapse together.
 */
export function normalizeForDuplicate(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
