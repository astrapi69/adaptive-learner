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

import type { ContentLesson } from "../../storage/types";

export interface ValidationMeta {
  title: string;
  title_native?: string | null;
  target_language: string;
  source_language: string;
  level: string;
}

export interface ValidationIssue {
  /** i18n suffix: ``content.validation.{code}``. */
  code: string;
  /** Interpolation params for the message + context. */
  params?: Record<string, string | number>;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
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

function base(code: string): string {
  return (code || "").split("-")[0].toLowerCase();
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

function validateMeta(meta: ValidationMeta, issues: ValidationIssue[]): void {
  const target = base(meta.target_language);
  const source = base(meta.source_language);

  if (!target) issues.push({ code: "missing_target_language" });
  else if (!ISO_639_1.test(target))
    issues.push({ code: "invalid_target_language", params: { code: target } });

  if (!source) issues.push({ code: "missing_source_language" });
  else if (!ISO_639_1.test(source))
    issues.push({ code: "invalid_source_language", params: { code: source } });

  if (target && source && target === source)
    issues.push({ code: "same_source_target", params: { code: target } });

  if (!meta.title || !meta.title.trim())
    issues.push({ code: "missing_title" });
  if (!meta.title_native || !meta.title_native.trim())
    issues.push({ code: "missing_title_native" });
}

function validateLesson(
  lesson: ContentLesson,
  meta: ValidationMeta,
  issues: ValidationIssue[],
): void {
  const id = lesson.id;
  const exercises = lesson.steps
    .filter((s) => s.type === "exercise" && s.exercise)
    .map((s) => s.exercise!);
  const theoryCount = lesson.steps.filter((s) => s.type === "theory").length;
  const types = new Set(exercises.map((e) => e.type));

  if (exercises.length < QUALITY.minExercisesPerLesson)
    issues.push({
      code: "lesson_too_few_exercises",
      params: { lesson: id, count: exercises.length, min: QUALITY.minExercisesPerLesson },
    });

  if (types.size < QUALITY.minExerciseTypes)
    issues.push({
      code: "lesson_too_few_types",
      params: { lesson: id, count: types.size, min: QUALITY.minExerciseTypes },
    });

  if (theoryCount < QUALITY.minTheorySteps)
    issues.push({ code: "lesson_no_theory", params: { lesson: id } });

  for (const card of lesson.cards) {
    if (!card.front || !card.front.trim() || !card.back || !card.back.trim()) {
      issues.push({ code: "empty_card", params: { lesson: id, card: card.id } });
    } else if (!backLooksLikeSource(card.back, meta.source_language)) {
      issues.push({
        code: "back_language_mismatch",
        params: { lesson: id, card: card.id, source: base(meta.source_language) },
      });
    }
  }

  for (const ex of exercises) {
    if (ex.type === "free_text") {
      if ((ex.accept?.length ?? 0) < QUALITY.minFreeTextAccepts)
        issues.push({
          code: "free_text_too_few_accepts",
          params: { lesson: id, exercise: ex.id, min: QUALITY.minFreeTextAccepts },
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
          params: { lesson: id, exercise: ex.id, min: QUALITY.minMatchingPairs },
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
  validateMeta(meta, issues);
  if (lessons.length === 0) {
    issues.push({ code: "no_lessons" });
  }
  for (const lesson of lessons) {
    validateLesson(lesson, meta, issues);
  }
  return { ok: issues.length === 0, issues };
}
