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

import type { Lesson as EngineLesson } from "learn-content-engine";
import {
  QUALITY_MINIMUMS,
  validateLessonQuality,
  validateLessonRules,
  validateManifestRules,
} from "learn-content-engine/rules";

import type { ContentLesson } from "../../../storage/types";
import { APP_EXTENSION_REGISTRY } from "./engine-extensions";

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

/** Quality minimums, for display: the engine's ``QUALITY_MINIMUMS``, the
 *  numbers its ``validateLessonQuality`` checks (#3345). Re-exported under
 *  the old name so existing importers keep working; no app copy (#3399). */
export const QUALITY = QUALITY_MINIMUMS;

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

/**
 * Engine manifest warnings the share check treats as BLOCKING (#3356).
 * The rule logic is the engine's (``validateManifestRules``); which of its
 * warnings stop a share is the app's policy. These two blocked as app
 * errors before the switch, so they keep blocking; the content repos'
 * version of this list is adaptive-learner-content-template#83.
 */
const BLOCKING_MANIFEST_WARNINGS: ReadonlySet<string> = new Set([
  "W-LANG-PAIR-SAME",
  "W-SET-TITLE-NATIVE",
]);

type EngineFinding = ReturnType<typeof validateManifestRules>["errors"][number];

/** An engine set-level finding as the share check's ``{code, params}``:
 *  mapped by rule id and ``params``, never by message text; a rule without
 *  an app code keeps its id, path and message. */
function manifestFindingIssue(finding: EngineFinding): ValidationIssue {
  const param = (key: string) => String(finding.params?.[key] ?? "");
  switch (finding.id) {
    case "E-LANG-TAG":
      return {
        code:
          param("field") === "source_language"
            ? "invalid_source_language"
            : "invalid_target_language",
        params: { code: param("tag") },
      };
    case "W-LANG-PAIR-SAME":
      return { code: "same_source_target", params: { code: param("language") } };
    case "W-SET-TITLE-NATIVE":
      return { code: "missing_title_native" };
    case "W-LEVEL-UNKNOWN":
      return { code: "non_cefr_level", params: { level: param("level") } };
    default:
      return {
        code: finding.severity === "error" ? "engine_set_rule" : "engine_set_warning",
        params: { rule: finding.id, path: finding.path, message: finding.message },
      };
  }
}

/**
 * Set metadata: presence of the fields the share form asks for is the
 * app's check; the language and level RULES are the engine's
 * ``validateManifestRules`` (#3356), run on the set as a one-set manifest.
 * A missing source is left out of the engine call, so its default ("en")
 * cannot raise a pair finding next to ``missing_source_language``.
 */
function validateMeta(
  meta: ValidationMeta,
  issues: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  const target = (meta.target_language || "").trim();
  const source = (meta.source_language || "").trim();
  if (!target) issues.push({ code: "missing_target_language" });
  if (!source) issues.push({ code: "missing_source_language" });
  if (!meta.title || !meta.title.trim()) issues.push({ code: "missing_title" });

  const verdict = validateManifestRules({
    sets: [
      {
        title: meta.title,
        ...(meta.title_native ? { title_native: meta.title_native } : {}),
        ...(target ? { target_language: target } : {}),
        ...(source ? { source_language: source } : {}),
        ...(meta.level ? { level: meta.level } : {}),
        ...(meta.domain ? { domain: meta.domain } : {}),
      },
    ],
  });
  for (const error of verdict.errors) issues.push(manifestFindingIssue(error));
  for (const warning of verdict.warnings) {
    if (!source && warning.id === "W-LANG-PAIR-SAME") continue;
    const issue = manifestFindingIssue(warning);
    if (BLOCKING_MANIFEST_WARNINGS.has(warning.id)) issues.push(issue);
    else warnings.push(issue);
  }
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

/** Issue on an empty card (blank front or back). Whether a back reads like
 *  the source language is the engine's ``W-CARD-BACK-SCRIPT`` (#3383), see
 *  ``checkEngineRules``. */
function checkCards(
  lesson: ContentLesson,
  id: string,
  issues: ValidationIssue[],
): void {
  for (const card of lesson.cards) {
    if (!card.front || !card.front.trim() || !card.back || !card.back.trim()) {
      issues.push({
        code: "empty_card",
        params: { lesson: id, card: card.id },
      });
    }
  }
}

/**
 * Engine warnings the app already reports through a code of its own, so
 * they are not repeated under ``engine_warning``:
 *
 * - ``W-DOMAIN-UNKNOWN`` is raised per LESSON ``domain``; the set's domain
 *   is a meta choice the wizard makes once, and the app judges it there.
 */
const ENGINE_WARNINGS_COVERED_BY_APP: ReadonlySet<string> = new Set([
  "W-DOMAIN-UNKNOWN",
]);

/**
 * #3383 - ``W-CARD-BACK-SCRIPT`` (a card back has letters but none of the
 * source language's script) is the engine's rule; the app only decides that
 * it BLOCKS a share, reported per card as ``back_language_mismatch``.
 */
function cardBackScriptIssues(
  warning: { params?: Record<string, unknown> },
  id: string,
): ValidationIssue[] {
  const cardIds = Array.isArray(warning.params?.cardIds) ? warning.params.cardIds : [];
  const source = base(String(warning.params?.sourceLanguage ?? ""));
  return cardIds.map((card) => ({
    code: "back_language_mismatch",
    params: { lesson: id, card: String(card), source },
  }));
}

/** The exercise id of the step an engine issue path points into, or "". */
function exerciseIdAt(lesson: ContentLesson, path: string): string {
  const stepIndex = Number(/^\/steps\/(\d+)(?:\/|$)/.exec(path)?.[1]);
  return lesson.steps[stepIndex]?.exercise?.id ?? "";
}

/**
 * #3222 PR 5 - every semantic rule and author lint of
 * ``learn-content-engine/rules`` judges the lesson here, with the app's
 * extension registry (so an adopted ``ext:al-*`` type passes as declared
 * and its payload is checked by the app's own predicate) and the set's
 * source language (the engine's script lints read it). The author learns
 * about a finding BEFORE an export or share with exactly the verdict the
 * content-repo gate will give.
 *
 * ``E-MATCH-DUP-LEFT`` keeps its dedicated wording (#2376 class 4, PR 2):
 * a repeated left value is objectively unsolvable for the learner. Every
 * other error renders through the generic ``engine_rule`` key, every
 * warning not already covered by an app code through ``engine_warning``;
 * both carry the rule id, the JSON path and the engine's message.
 *
 * The ``/rules`` entry carries no schema files and no ajv, and this module
 * lives in a lazy chunk, so the entry chunk stays rule-free.
 */
function checkEngineRules(
  lesson: ContentLesson,
  meta: ValidationMeta,
  id: string,
  issues: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  const verdict = validateLessonRules(lesson as unknown as EngineLesson, {
    extensions: APP_EXTENSION_REGISTRY,
    sourceLanguage: meta.source_language,
  });
  for (const error of verdict.errors) {
    if (error.id === "E-MATCH-DUP-LEFT") {
      issues.push({
        code: "matching_duplicate_left",
        params: {
          lesson: id,
          exercise: exerciseIdAt(lesson, error.path),
          value: String(error.params?.term ?? ""),
        },
      });
      continue;
    }
    issues.push({
      code: "engine_rule",
      params: { lesson: id, rule: error.id, path: error.path, message: error.message },
    });
  }
  for (const warning of verdict.warnings) {
    if (warning.id === "W-CARD-BACK-SCRIPT") {
      issues.push(...cardBackScriptIssues(warning, id));
      continue;
    }
    if (ENGINE_WARNINGS_COVERED_BY_APP.has(warning.id)) continue;
    warnings.push({
      code: "engine_warning",
      params: { lesson: id, rule: warning.id, path: warning.path, message: warning.message },
    });
  }
}

/** Engine quality rule id -> the app's ``content.validation.{code}`` key. */
const QUALITY_CODE_BY_RULE: Readonly<Record<string, string>> = {
  "E-QUALITY-EXERCISES": "lesson_too_few_exercises",
  "E-QUALITY-TYPES": "lesson_too_few_types",
  "E-QUALITY-THEORY": "lesson_no_theory",
  "E-QUALITY-FREETEXT-ACCEPTS": "free_text_too_few_accepts",
  "E-QUALITY-MATCHING-PAIRS": "matching_too_few_pairs",
};

/**
 * #3345 - the quality minimums are the engine's ``validateLessonQuality``,
 * the check the content-repo gate runs, so a set passes here exactly when
 * it passes there. The lesson's ``purpose`` sets which minimums apply
 * (``bridge`` lifts the exercise and type counts, ``quiz`` the type count),
 * and a ``from_cards`` matching counts the pairs its cards derive, also in
 * the raw shape API mode serves. Mapped by rule id and ``params``, never by
 * message text; an id without an app code falls back to ``engine_rule``.
 *
 * The app's own copy also required distractors on ``free_text`` and
 * ``picture_choice``. The engine has no such minimum, and it is not checked
 * any more: a set without them now passes.
 */
function checkQualityMinimums(
  lesson: ContentLesson,
  id: string,
  issues: ValidationIssue[],
): void {
  const verdict = validateLessonQuality(lesson as unknown as EngineLesson);
  for (const error of verdict.errors) {
    const code = QUALITY_CODE_BY_RULE[error.id];
    if (!code) {
      issues.push({
        code: "engine_rule",
        params: { lesson: id, rule: error.id, path: error.path, message: error.message },
      });
      continue;
    }
    const exercise = exerciseIdAt(lesson, error.path);
    issues.push({
      code,
      params: {
        lesson: id,
        ...(exercise ? { exercise } : {}),
        count: Number(error.params?.count ?? 0),
        min: Number(error.params?.min ?? 0),
      },
    });
  }
}

function validateLesson(
  lesson: ContentLesson,
  meta: ValidationMeta,
  issues: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  const id = lesson.id;
  checkLevelComplexity(lesson, meta, id, warnings);
  checkQualityMinimums(lesson, id, issues);
  checkExampleUrls(lesson, id, issues);
  checkCards(lesson, id, issues);
  checkEngineRules(lesson, meta, id, issues, warnings);
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
