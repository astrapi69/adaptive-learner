/**
 * AI content-validation prompt + response parsing
 * (Phase 60 / v1.44.0 — C5b, opt-in AI layer).
 *
 * The rule-based validator (``content-validator.ts``) is the
 * gate; this supplementary layer asks the user's configured AI
 * provider to judge things rules can't: translation accuracy,
 * distractor plausibility, grammar in the theory, level fit,
 * cultural sensitivity and naturalness. It is ALWAYS opt-in and
 * NEVER blocks sharing — a failure here is non-fatal.
 *
 * This module is pure (prompt building + defensive parsing); the
 * actual AI call runs through ``getStorage().contentLoader.aiValidate``
 * so it works in both modes (Dexie = browser-direct, API = backend).
 */

import type { ContentLesson } from "../../storage/types";
import { extractJsonObject } from "../extract-json";
import type { ValidationMeta } from "./content-validator";

export interface AiTranslationIssue {
  card_id: string;
  issue: string;
  suggestion: string;
}
export interface AiDistractorIssue {
  exercise_id: string;
  issue: string;
  suggestion: string;
}
export interface AiGrammarIssue {
  step_id: string;
  issue: string;
  correction: string;
}
export interface AiLevelIssue {
  item: string;
  issue: string;
  suggestion: string;
}

export interface AiValidationResult {
  overall: "pass" | "review_needed";
  translation_issues: AiTranslationIssue[];
  distractor_issues: AiDistractorIssue[];
  grammar_issues: AiGrammarIssue[];
  level_issues: AiLevelIssue[];
  cultural_flags: string[];
  quality_score: number;
}

/** Build the (system, user) messages for an AI content review. */
export function buildAiValidationMessages(
  meta: ValidationMeta,
  lessons: ContentLesson[],
): { role: "system" | "user"; content: string }[] {
  const system = [
    "You are a meticulous language-learning content reviewer.",
    `The learner SPEAKS ${meta.source_language} and is LEARNING ${meta.target_language} at level ${meta.level}.`,
    "Card 'front' is in the target language; card 'back' + notes + theory are in the source language.",
    "Review the lesson(s) for:",
    "- translation accuracy (does each front/back pair mean the same thing?)",
    "- distractor quality (are wrong options plausible but clearly wrong, not random?)",
    "- grammar accuracy in the theory/explanations (source language)",
    "- level appropriateness (vocabulary + grammar fit the stated CEFR level?)",
    "- cultural sensitivity (flag anything offensive or insensitive)",
    "- natural language (not word-for-word/machine-translated phrasing)",
    "",
    "Respond with ONLY a JSON object, no prose, in EXACTLY this shape:",
    "{",
    '  "overall": "pass" | "review_needed",',
    '  "translation_issues": [{"card_id": "...", "issue": "...", "suggestion": "..."}],',
    '  "distractor_issues": [{"exercise_id": "...", "issue": "...", "suggestion": "..."}],',
    '  "grammar_issues": [{"step_id": "...", "issue": "...", "correction": "..."}],',
    '  "level_issues": [{"item": "...", "issue": "...", "suggestion": "..."}],',
    '  "cultural_flags": ["..."],',
    '  "quality_score": 0.0',
    "}",
    "quality_score is 0.0-1.0. Use empty arrays when there are no issues.",
    "Write 'issue'/'suggestion'/'correction' text in the source language.",
  ].join("\n");

  const user = JSON.stringify(
    {
      target_language: meta.target_language,
      source_language: meta.source_language,
      level: meta.level,
      lessons: lessons.map((l) => ({
        id: l.id,
        cards: l.cards.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
          notes: c.notes ?? undefined,
        })),
        steps: l.steps.map((s) => ({
          id: s.id,
          type: s.type,
          body: s.body ?? undefined,
          exercise: s.exercise
            ? {
                id: s.exercise.id,
                type: s.exercise.type,
                prompt: s.exercise.prompt,
                distractors: s.exercise.distractors,
              }
            : undefined,
        })),
      })),
    },
    null,
    0,
  );

  return [
    { role: "system", content: system },
    { role: "user", content: `Validate this lesson set:\n${user}` },
  ];
}

function asIssueArray<T>(value: unknown, keys: string[]): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((row) => {
      const out: Record<string, string> = {};
      for (const k of keys) out[k] = typeof row[k] === "string" ? (row[k] as string) : "";
      return out as T;
    })
    .filter((row) => Object.values(row as Record<string, string>).some((v) => v));
}

/** Parse a raw AI response into a normalised result, or null if
 *  the response had no usable JSON object. */
export function parseAiValidationResult(raw: string): AiValidationResult | null {
  const obj = extractJsonObject(raw);
  if (!obj) return null;
  const score = typeof obj.quality_score === "number" ? obj.quality_score : 0;
  const translation = asIssueArray<AiTranslationIssue>(obj.translation_issues, [
    "card_id",
    "issue",
    "suggestion",
  ]);
  const distractor = asIssueArray<AiDistractorIssue>(obj.distractor_issues, [
    "exercise_id",
    "issue",
    "suggestion",
  ]);
  const grammar = asIssueArray<AiGrammarIssue>(obj.grammar_issues, [
    "step_id",
    "issue",
    "correction",
  ]);
  const level = asIssueArray<AiLevelIssue>(obj.level_issues, [
    "item",
    "issue",
    "suggestion",
  ]);
  const cultural = Array.isArray(obj.cultural_flags)
    ? obj.cultural_flags.filter((x): x is string => typeof x === "string")
    : [];
  const hasIssues =
    translation.length + distractor.length + grammar.length + level.length + cultural.length > 0;
  const overall: "pass" | "review_needed" =
    obj.overall === "pass" || obj.overall === "review_needed"
      ? obj.overall
      : hasIssues
        ? "review_needed"
        : "pass";
  return {
    overall,
    translation_issues: translation,
    distractor_issues: distractor,
    grammar_issues: grammar,
    level_issues: level,
    cultural_flags: cultural,
    quality_score: Math.max(0, Math.min(1, score)),
  };
}
