/**
 * Smart placement engine for community lesson organization
 * (Phase 64A).
 *
 * Given a lesson's metadata (+ optionally its cards) and the set of
 * already-known content sets, work out exactly WHERE the lesson
 * belongs in the source-language tree and what it should be called:
 *
 *   sets/{source}/{target}-{level}/  +  {nn}-{topic-slug}.json
 *
 * so the Share wizard can show the user a concrete placement
 * ("Deutsch -> Französisch -> A1 / 16-konjugation.json, next to 15
 * existing lessons") and detect when they are the FIRST to author a
 * set for a language pair + level.
 *
 * This module is the auto-numbering + new-set-detection +
 * content-auto-detection layer on top of the existing
 * ``treePlacement`` (path) and ``slugify`` / ``detectTargetLanguage``
 * (analysis-to-lesson) — it does NOT re-implement the tree path.
 * Pure + side-effect-free; every result is advisory and the user can
 * always override it in the wizard.
 */

import type { ContentLessonCard, ContentSetEntry } from "../../storage/types";
import { detectTargetLanguage, slugify } from "./analysis-to-lesson";
import { treePlacement } from "./validation/content-validator";

export interface PlacementMeta {
  source_language: string;
  target_language: string;
  level: string;
}

export interface PlacementResult {
  /** Base source-language code (e.g. "de"). */
  source: string;
  /** Base target-language code (e.g. "fr"). */
  target: string;
  /** CEFR level as authored (e.g. "A1"). */
  level: string;
  /** Repo-relative set directory, e.g. "sets/de/fr-a1". */
  path: string;
  /** Suggested filename, e.g. "16-konjugation-praeteritum.json". */
  filename: string;
  /** Auto-assigned lesson number (16). */
  number: number;
  /** Zero-padded number label ("16", "07"). */
  numberLabel: string;
  /** True when no published set exists yet for this pair + level —
   *  drives the "Neues Set! Du bist der Erste." message. */
  isNewSet: boolean;
  /** Lessons already in the set (0 for a new set). */
  existingLessonCount: number;
}

function base(code: string): string {
  return (code || "").split("-")[0].toLowerCase();
}

/** Parse the leading ``NN-`` / ``NN_`` from a lesson filename;
 *  null when the file is not number-prefixed. */
function leadingNumber(filename: string): number | null {
  const match = /^(\d{1,3})[-_]/.exec(filename.trim());
  return match ? parseInt(match[1], 10) : null;
}

/** Next lesson number for a set = (highest existing leading number)
 *  + 1, or 1 for an empty/new set. Non-numbered files are ignored,
 *  so a stray ``readme.json`` never derails the sequence. */
export function nextLessonNumber(
  existingFilenames: readonly string[],
): number {
  let max = 0;
  for (const filename of existingFilenames) {
    const n = leadingNumber(filename);
    if (n !== null && n > max) max = n;
  }
  return max + 1;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Transliterate German umlauts the way the existing content-repo
 *  filenames do (``begruessung.json``, ``praeteritum``) so a German
 *  topic produces the repo's conventional ASCII slug instead of an
 *  awkward stripped one (ä->ae, ö->oe, ü->ue, ß->ss). */
function transliterateGerman(text: string): string {
  return text
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss");
}

/** Build the suggested ``{nn}-{slug}.json`` filename. German umlauts
 *  are transliterated first (matching the repo's existing filenames);
 *  falls back to a generic slug when the topic produces nothing
 *  slug-safe. */
export function suggestFilename(num: number, topic: string): string {
  const slug = slugify(transliterateGerman(topic)) || "lektion";
  return `${pad2(num)}-${slug}.json`;
}

/**
 * Does a PUBLISHED set already exist for this language pair + level?
 * User-generated sets (the sharer's own "My Lessons" drafts) never
 * count — being the only draft does not make you "not the first".
 */
export function setExistsInTree(
  meta: PlacementMeta,
  knownSets: readonly ContentSetEntry[],
): boolean {
  const source = base(meta.source_language);
  const target = base(meta.target_language);
  const level = (meta.level || "").trim().toLowerCase();
  return knownSets.some(
    (entry) =>
      entry.source !== "user-generated" &&
      base(entry.source_language) === source &&
      base(entry.target_language) === target &&
      (entry.level || "").trim().toLowerCase() === level,
  );
}

export interface ComputePlacementInput {
  meta: PlacementMeta;
  /** Title or topic used to slug the filename. */
  topic: string;
  /** Filenames already in the target set (from
   *  ``contentLoader.listLessons``). Empty for a brand-new set. */
  existingLessonFilenames: readonly string[];
  /** All known sets, used to decide ``isNewSet``. */
  knownSets: readonly ContentSetEntry[];
}

/** Compute the full placement (path + auto-numbered filename + new-set
 *  flag) for a lesson about to be shared. */
export function computePlacement(
  input: ComputePlacementInput,
): PlacementResult {
  // treePlacement reads only the language + level fields; the dummy
  // ``title`` satisfies its ValidationMeta param without affecting the
  // result (the path never uses the title).
  const placement = treePlacement({ ...input.meta, title: "" });
  const number = nextLessonNumber(input.existingLessonFilenames);
  return {
    source: placement.source,
    target: placement.target,
    level: placement.level,
    path: placement.path,
    filename: suggestFilename(number, input.topic),
    number,
    numberLabel: pad2(number),
    isNewSet: !setExistsInTree(input.meta, input.knownSets),
    existingLessonCount: input.existingLessonFilenames.length,
  };
}

// ---------------------------------------------------------------------------
// Content-based auto-detection (advisory; the wizard pre-fills these
// when metadata is incomplete, and the user can always override).
// ---------------------------------------------------------------------------

// Non-Latin scripts we can tell apart by character range (mirrors the
// content-validator heuristic). Latin-script target languages
// (fr/es/de/it/...) are NOT distinguishable by characters alone, so
// target detection for those relies on the topic/title text.
const SCRIPT_RANGES: Record<string, RegExp> = {
  el: /[Ͱ-Ͽἀ-῿]/, // Greek
  ja: /[぀-ヿ一-鿿]/, // Kana + Kanji
  ru: /[Ѐ-ӿ]/, // Cyrillic
  ar: /[؀-ۿ]/, // Arabic
  ko: /[가-힯]/, // Hangul
};

/**
 * Best-effort target-language guess: the topic/title first (reuses
 * the analysis detector — "Französisch A1" -> "fr"), then a
 * script-range scan of the card fronts (the target text) for
 * non-Latin languages. Returns null when unsure; the wizard then
 * asks the user rather than guessing wrong.
 */
export function autoDetectTargetLanguage(
  topic: string | undefined,
  cards: readonly ContentLessonCard[],
): string | null {
  const fromTopic = detectTargetLanguage(topic);
  if (fromTopic) return fromTopic;
  const fronts = cards.map((card) => card.front).join(" ");
  for (const [lang, range] of Object.entries(SCRIPT_RANGES)) {
    if (range.test(fronts)) return lang;
  }
  return null;
}

/**
 * Estimate a CEFR level from vocabulary complexity — a cheap proxy
 * using the average and maximum token count of the card fronts.
 * Short single words -> A1; short phrases/sentences -> A2/B1; longer
 * -> B2/C1. Advisory only; A1 is the conservative default for an
 * empty deck.
 */
export function estimateLevel(cards: readonly ContentLessonCard[]): string {
  if (cards.length === 0) return "A1";
  let totalWords = 0;
  let maxWords = 0;
  for (const card of cards) {
    const n = card.front.trim().split(/\s+/).filter(Boolean).length;
    totalWords += n;
    if (n > maxWords) maxWords = n;
  }
  const avg = totalWords / cards.length;
  if (avg <= 2 && maxWords <= 4) return "A1";
  if (avg <= 3.5 && maxWords <= 7) return "A2";
  if (avg <= 6) return "B1";
  return "B2";
}

/**
 * Suggest a topic for the filename slug: the most frequent card tag
 * when it covers a meaningful share of the deck, otherwise the
 * lesson title. Keeps auto-generated filenames descriptive
 * ("12-farben.json") without inventing a theme the cards don't
 * support.
 */
export function suggestTopic(
  cards: readonly ContentLessonCard[],
  fallbackTitle: string,
): string {
  const counts = new Map<string, number>();
  for (const card of cards) {
    for (const tag of card.tags || []) {
      const normalized = tag.trim().toLowerCase();
      if (normalized) counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [tag, count] of counts) {
    if (count > bestCount) {
      best = tag;
      bestCount = count;
    }
  }
  const threshold = Math.max(2, Math.ceil(cards.length * 0.4));
  if (best && bestCount >= threshold) return best;
  return fallbackTitle;
}
