/**
 * Client-side content validation pipeline (Phase 60 / v1.44.0).
 *
 * Runs BEFORE a user shares a lesson with the community: schema +
 * language-pair + quality checks. The thresholds are MINIMUMS,
 * not recommendations — a set below any of them cannot be shared.
 * This is the first of the two validation layers; the content
 * repo's CI workflow (validate-content.yml) re-runs the same
 * checks on manual PRs so neither path can publish broken content.
 *
 * Pure + deterministic: returns structured {code, params} issues
 * that the UI localises via ``content.validation.{code}`` i18n
 * keys, so error messages stay translatable and specific.
 */

import type { ContentLesson } from "../../../storage/types";

export interface ValidationMeta {
  title: string;
  title_native?: string | null;
  target_language: string;
  source_language: string;
  level: string;
  /** Content domain. Defaults to "language". Non-language domains
   *  (e.g. "psychology") are material explained IN the same language
   *  they teach, so source == target is allowed. Mirrors the content
   *  repo's ``validate_content.py`` ``set_domain`` relaxation. */
  domain?: string | null;
}

/** Normalised content domain; "language" when unset. Mirrors
 *  ``set_domain`` in the content repo's validate_content.py. */
function setDomain(meta: ValidationMeta): string {
  return (meta.domain || "language").trim().toLowerCase();
}

export interface ValidationIssue {
  /** i18n suffix: ``content.validation.{code}``. */
  code: string;
  /** Interpolation params for the message + context. */
  params?: Record<string, string | number>;
}

export interface ValidationResult {
  /** True when there are no blocking ``issues`` (warnings do NOT
   *  affect this — the user can share past warnings). */
  ok: boolean;
  /** Blocking problems: schema / language pair / quality minimums.
   *  Any entry here means the set cannot be shared. */
  issues: ValidationIssue[];
  /** Non-blocking advisories: language-heuristic mismatches, CEFR /
   *  word-count level hints. Surfaced yellow; sharing stays
   *  enabled. */
  warnings: ValidationIssue[];
}

/** Quality minimums. Below any of these = cannot share. */
export const QUALITY = {
  minExercisesPerLesson: 5,
  minExerciseTypes: 2,
  minFreeTextAccepts: 2,
  minMatchingPairs: 3,
  minTheorySteps: 1,
} as const;

// ISO 639-1 base subtag: exactly two lowercase letters. The
// schema is more permissive (BCP-47), but community language sets
// must use a plain 2-letter code so the tree groups cleanly.
const ISO_639_1 = /^[a-z]{2}$/;

/** CEFR levels a community language set is expected to declare. */
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

/** Average words-per-card-side above which a level looks too hard
 *  for the declared CEFR band (a coarse proxy — the AI review
 *  judges level fit properly). A1/A2 should stay short. */
const MAX_AVG_WORDS_PER_SIDE: Record<string, number> = {
  a1: 10,
  a2: 14,
  b1: 20,
  b2: 30,
};

// Characters that strongly indicate ONE specific supported
// language. Used for POSITIVE cross-language detection: a marker
// belonging to a language OTHER than the declared one is evidence
// of mislabelling. ABSENCE is never evidence — diacritic-free text
// is completely normal (French "Bonjour, un, le" has no accents),
// so we only warn when a conflicting marker is actually present.
// Only highly-exclusive markers are listed (shared accents like
// é/à/ç span fr/es/pt/it and would false-positive).
// Non-Latin SCRIPT markers — unambiguous and safe to check on BOTH
// sides: nobody quotes Japanese/Greek inside German prose about
// French, so their presence where another language is declared is
// strong evidence of mislabelling.
const NON_LATIN_MARKERS: { lang: string; re: RegExp }[] = [
  { lang: "el", re: /[Ͱ-Ͽἀ-῿]/ },
  { lang: "ja", re: /[぀-ヿ一-鿿]/ },
  { lang: "ru", re: /[Ѐ-ӿ]/ },
  { lang: "ar", re: /[؀-ۿ]/ },
  { lang: "ko", re: /[가-힯]/ },
];

// Latin-script EXCLUSIVE markers — only checked on the TARGET FRONT
// (pure target-language vocab). They are NOT checked on the source
// back/notes: explanatory prose in the source language legitimately
// QUOTES the target language (an English note about Spanish contains
// ñ / ¿), which would false-positive. Shared accents (é/à/ç) are
// omitted entirely — they span fr/es/pt/it.
const LATIN_MARKERS: { lang: string; re: RegExp }[] = [
  { lang: "de", re: /ß/ },
  { lang: "es", re: /[ñ¿¡]/ },
  { lang: "tr", re: /[ığş]/i },
];

/** Return the base code of a language whose marker appears in
 *  ``text`` but differs from ``expected`` — positive evidence of the
 *  wrong language. ``includeLatin`` adds the Latin-marker set (used
 *  for the target front only). ``null`` when nothing conflicts
 *  (including diacritic-free text in the expected language). */
function conflictingLanguage(
  text: string,
  expected: string,
  includeLatin: boolean,
): string | null {
  const exp = base(expected);
  const markers = includeLatin
    ? [...NON_LATIN_MARKERS, ...LATIN_MARKERS]
    : NON_LATIN_MARKERS;
  for (const { lang, re } of markers) {
    if (lang !== exp && re.test(text)) return lang;
  }
  return null;
}

function base(code: string): string {
  return (code || "").split("-")[0].toLowerCase();
}

/**
 * Where a set lands in the source-language tree, for the share
 * preview. Returns the breadcrumb codes + the repo-relative path.
 */
export function treePlacement(meta: ValidationMeta): {
  source: string;
  target: string;
  level: string;
  path: string;
} {
  const source = base(meta.source_language) || "??";
  const target = base(meta.target_language) || "??";
  const level = (meta.level || "").trim();
  return {
    source,
    target,
    level,
    path: `sets/${source}/${target}-${level.toLowerCase()}`,
  };
}

// Scripts we CAN tell apart from Latin. For a non-Latin source
// language we require the card backs to actually use that script
// (a Greek-source set whose backs are all Latin is mislabelled).
// Latin-script source languages are skipped — we can't reliably
// tell German from English by characters alone, so we don't guess.
const SCRIPT_RANGES: Record<string, RegExp> = {
  el: /[Ͱ-Ͽἀ-῿]/, // Greek
  ja: /[぀-ヿ一-鿿]/, // Hiragana/Katakana/Kanji
  zh: /[一-鿿]/, // Han
  ru: /[Ѐ-ӿ]/, // Cyrillic
  ar: /[؀-ۿ]/, // Arabic
  ko: /[가-힯]/, // Hangul
};

function backLooksLikeSource(text: string, sourceLang: string): boolean {
  const range = SCRIPT_RANGES[base(sourceLang)];
  if (!range) return true; // Latin-script source — can't tell, accept.
  return range.test(text);
}

function validateMeta(
  meta: ValidationMeta,
  issues: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  const target = base(meta.target_language);
  const source = base(meta.source_language);

  if (!target) issues.push({ code: "missing_target_language" });
  else if (!ISO_639_1.test(target))
    issues.push({ code: "invalid_target_language", params: { code: target } });

  if (!source) issues.push({ code: "missing_source_language" });
  else if (!ISO_639_1.test(source))
    issues.push({ code: "invalid_source_language", params: { code: source } });

  // Non-language sets are explained in (and written in) the same
  // language they teach, so source == target is expected and allowed.
  if (target && source && target === source && setDomain(meta) === "language")
    issues.push({ code: "same_source_target", params: { code: target } });

  if (!meta.title || !meta.title.trim()) issues.push({ code: "missing_title" });
  if (!meta.title_native || !meta.title_native.trim())
    issues.push({ code: "missing_title_native" });

  // CEFR level: a warning (not a hard block — non-language domains
  // legitimately use other scales like "beginner").
  const level = (meta.level || "").trim().toUpperCase();
  if (!(CEFR_LEVELS as readonly string[]).includes(level))
    warnings.push({ code: "non_cefr_level", params: { level: meta.level } });
}

/**
 * Set-level language heuristic (Phase 61). Aggregates ALL card
 * `back`/`notes` text (should be the source language) and all
 * `front` text (should be the target language) and warns only when
 * a marker EXCLUSIVE to a different supported language is present
 * (e.g. Spanish ñ in a set labelled German, or Greek script where
 * French is expected). Positive evidence only — absence of the
 * expected language's diacritics is NOT flagged, because legitimate
 * short A1 vocab is routinely diacritic-free. Always a WARNING,
 * never a hard block.
 */
function validateLanguageHeuristics(
  meta: ValidationMeta,
  lessons: ContentLesson[],
  warnings: ValidationIssue[],
): void {
  let backText = "";
  let frontText = "";
  for (const lesson of lessons) {
    for (const card of lesson.cards) {
      backText += " " + (card.back ?? "") + " " + (card.notes ?? "");
      frontText += " " + (card.front ?? "");
    }
  }
  const checkSide = (
    text: string,
    lang: string,
    code: string,
    includeLatin: boolean,
  ): void => {
    // Warn only on POSITIVE evidence: a marker for a DIFFERENT
    // language is present. Never warn on absence (diacritic-free
    // A1 vocab is normal). Latin markers are checked only on the
    // target front, never on the source back/notes (which quote
    // the target language).
    const found = conflictingLanguage(text, lang, includeLatin);
    if (found) warnings.push({ code, params: { lang: base(lang), found } });
  };
  // Source side = back + notes (prose): non-Latin scripts only.
  checkSide(backText, meta.source_language, "source_language_heuristic", false);
  // Target side = front (pure vocab): Latin markers + non-Latin.
  checkSide(frontText, meta.target_language, "target_language_heuristic", true);
}

type LessonExercise = NonNullable<ContentLesson["steps"][number]["exercise"]>;

/** Warn when the cards' average words-per-side exceeds the level's CEFR cap.
 *  Averaged PER side (front vs back) so a short target-language front does
 *  not mask a wordy source-language back. */
function checkLevelComplexity(
  lesson: ContentLesson,
  meta: ValidationMeta,
  id: string,
  warnings: ValidationIssue[],
): void {
  const level = (meta.level || "").trim().toLowerCase();
  const cap = MAX_AVG_WORDS_PER_SIDE[level];
  if (cap === undefined || lesson.cards.length === 0) return;
  const wordsOf = (s: string | null | undefined) =>
    s && s.trim() ? s.trim().split(/\s+/).length : 0;
  const frontAvg =
    lesson.cards.reduce((n, c) => n + wordsOf(c.front), 0) /
    lesson.cards.length;
  const backAvg =
    lesson.cards.reduce((n, c) => n + wordsOf(c.back), 0) /
    lesson.cards.length;
  const avg = Math.max(frontAvg, backAvg);
  if (avg > cap)
    warnings.push({
      code: "level_too_complex",
      params: { lesson: id, level: meta.level, avg: avg.toFixed(1), cap },
    });
}

/** Issue when a lesson has too few exercises, too few exercise types, or no
 *  theory step. */
function checkLessonCounts(
  exercises: LessonExercise[],
  types: Set<string>,
  theoryCount: number,
  id: string,
  issues: ValidationIssue[],
): void {
  if (exercises.length < QUALITY.minExercisesPerLesson)
    issues.push({
      code: "lesson_too_few_exercises",
      params: {
        lesson: id,
        count: exercises.length,
        min: QUALITY.minExercisesPerLesson,
      },
    });

  if (types.size < QUALITY.minExerciseTypes)
    issues.push({
      code: "lesson_too_few_types",
      params: { lesson: id, count: types.size, min: QUALITY.minExerciseTypes },
    });

  if (theoryCount < QUALITY.minTheorySteps)
    issues.push({ code: "lesson_no_theory", params: { lesson: id } });
}

/** #139 — a theory example link (schema v1.4) must be an http(s) URL when
 *  present. */
function checkExampleUrls(
  lesson: ContentLesson,
  id: string,
  issues: ValidationIssue[],
): void {
  for (const step of lesson.steps) {
    const url = step.example_url?.trim();
    if (url && !/^https?:\/\//i.test(url))
      issues.push({
        code: "example_url_invalid",
        params: { lesson: id, step: step.id },
      });
  }
}

/** Issue on an empty card (blank front or back) or a back-side that does not
 *  read like the set's source language. */
function checkCards(
  lesson: ContentLesson,
  meta: ValidationMeta,
  id: string,
  issues: ValidationIssue[],
): void {
  for (const card of lesson.cards) {
    if (!card.front || !card.front.trim() || !card.back || !card.back.trim()) {
      issues.push({
        code: "empty_card",
        params: { lesson: id, card: card.id },
      });
    } else if (!backLooksLikeSource(card.back, meta.source_language)) {
      issues.push({
        code: "back_language_mismatch",
        params: {
          lesson: id,
          card: card.id,
          source: base(meta.source_language),
        },
      });
    }
  }
}

/** Issue on per-exercise-type quality minimums (free-text accepts +
 *  distractors, matching pairs, picture-choice distractors). */
function checkLessonExercises(
  exercises: LessonExercise[],
  id: string,
  issues: ValidationIssue[],
): void {
  for (const ex of exercises) {
    if (ex.type === "free_text") {
      if ((ex.accept?.length ?? 0) < QUALITY.minFreeTextAccepts)
        issues.push({
          code: "free_text_too_few_accepts",
          params: {
            lesson: id,
            exercise: ex.id,
            min: QUALITY.minFreeTextAccepts,
          },
        });
      if (ex.distractors.length === 0)
        issues.push({
          code: "missing_distractors",
          params: { lesson: id, exercise: ex.id },
        });
    }
    if (ex.type === "matching") {
      if ((ex.pairs?.length ?? 0) < QUALITY.minMatchingPairs)
        issues.push({
          code: "matching_too_few_pairs",
          params: {
            lesson: id,
            exercise: ex.id,
            min: QUALITY.minMatchingPairs,
          },
        });
    }
    if (ex.type === "picture_choice") {
      if (ex.distractors.length === 0)
        issues.push({
          code: "missing_distractors",
          params: { lesson: id, exercise: ex.id },
        });
    }
  }
}

function validateLesson(
  lesson: ContentLesson,
  meta: ValidationMeta,
  issues: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  const id = lesson.id;
  const exercises = lesson.steps
    .filter((s) => s.type === "exercise" && s.exercise)
    .map((s) => s.exercise!);
  const theoryCount = lesson.steps.filter((s) => s.type === "theory").length;
  const types = new Set(exercises.map((e) => e.type));

  checkLevelComplexity(lesson, meta, id, warnings);
  checkLessonCounts(exercises, types, theoryCount, id, issues);
  checkExampleUrls(lesson, id, issues);
  checkCards(lesson, meta, id, issues);
  checkLessonExercises(exercises, id, issues);
}

/**
 * Validate a set + its lessons for community sharing. Returns
 * ``ok: true`` with an empty issue list when the set clears every
 * schema, language-pair and quality minimum.
 */
export function validateSetForSharing(
  meta: ValidationMeta,
  lessons: ContentLesson[],
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  validateMeta(meta, issues, warnings);
  if (lessons.length === 0) {
    issues.push({ code: "no_lessons" });
  }
  for (const lesson of lessons) {
    validateLesson(lesson, meta, issues, warnings);
  }
  validateLanguageHeuristics(meta, lessons, warnings);
  return { ok: issues.length === 0, issues, warnings };
}
