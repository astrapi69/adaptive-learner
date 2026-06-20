/**
 * AIX-03 (EXP-036) — content quality gate for AI-generated exercises.
 *
 * The AIX-01 defensive parser ({@link parseGeneratedExercises}) guarantees
 * the cards are *structurally* valid (right shape, required fields). It
 * does NOT judge whether an exercise is any GOOD: a trivial question, a
 * one-character answer, a distractor identical to the answer, or two cards
 * asking the same thing all pass the parser. This deterministic gate (no
 * AI call) drops the bad ones and flags soft issues as warnings.
 *
 * Pipeline position:  AI -> Parser (AIX-01) -> Quality Gate (AIX-03) -> ...
 *
 * Rejections (the card is removed):
 *   - a later duplicate (same question OR same answer set as an earlier card)
 *   - the answer is a single word that also appears in the question
 *   - the answer is shorter than two characters
 *   - a matching card with fewer than three pairs
 *   - a distractor equal to the correct answer
 *
 * Warnings (the card is kept, the set is flagged):
 *   - all distractors identical
 *   - a cloze with fewer than two distractors
 *   - every exercise is the same type (recommend more variety)
 *   - >= 5 exercises but fewer than two types
 *   - question and answer appear to be in different scripts
 *
 * Library-grade: pure functions, no app-state / network imports.
 */

import type { ValidCard } from "./exercise-generation-parser";

/** A parsed, structurally-valid AI card (AIX-01 output). */
export type ExerciseCard = ValidCard;

/** Machine-readable warning code (the UI may localize by code). */
export type QualityWarningCode =
  | "all_distractors_identical"
  | "cloze_few_distractors"
  | "single_type"
  | "low_type_variety"
  | "language_mismatch";

/** A non-fatal quality issue. */
export interface QualityWarning {
  code: QualityWarningCode;
  /** Human-readable English detail (for logs / debug). */
  message: string;
  /** Index into the PASSED list when the warning is card-specific. */
  cardIndex?: number;
}

/** Outcome of the quality gate. */
export interface QualityResult {
  /** Cards that passed (input order preserved). */
  passed: ExerciseCard[];
  /** Cards dropped for a hard quality reason. */
  rejected: ExerciseCard[];
  /** Soft issues on the passed set. */
  warnings: QualityWarning[];
}

const MIN_ANSWER_LENGTH = 2;
const MIN_MATCHING_PAIRS = 3;

function norm(value: string): string {
  return value.trim().toLowerCase();
}

/** The correct answer(s) carried by a card. */
function answersOf(card: ExerciseCard): string[] {
  switch (card.type) {
    case "cloze":
      return [card.answer];
    case "word_tiles":
      return [card.answer];
    case "free_text":
      return card.accepts;
    case "matching":
      return card.pairs.map((pair) => pair.right);
    case "picture_choice":
      return card.options.filter((option) => option.is_correct).map((o) => o.label);
    default:
      return [];
  }
}

/** The distractors carried by a card (empty for types without them). */
function distractorsOf(card: ExerciseCard): string[] {
  switch (card.type) {
    case "cloze":
    case "free_text":
      return card.distractors;
    case "picture_choice":
      return card.options.filter((option) => !option.is_correct).map((o) => o.label);
    default:
      return [];
  }
}

/** A stable signature for duplicate-answer detection. */
function answerSignature(card: ExerciseCard): string {
  return answersOf(card).map(norm).filter(Boolean).sort().join("|");
}

/** Split a question into normalized word tokens. */
function questionWords(question: string): Set<string> {
  return new Set(
    question
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );
}

/** True when ``answer`` is a single word that also appears in ``question``. */
function answerEchoesQuestion(question: string, answer: string): boolean {
  const trimmed = answer.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  return questionWords(question).has(trimmed.toLowerCase());
}

/** Dominant Unicode script of ``text`` (letters only), or null. */
function dominantScript(text: string): string | null {
  const counts: Record<string, number> = {};
  for (const ch of text) {
    if (!/\p{L}/u.test(ch)) continue;
    const code = ch.codePointAt(0) ?? 0;
    let script: string;
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0x3400 && code <= 0x4dbf)
    ) {
      script = "cjk";
    } else if (code >= 0xac00 && code <= 0xd7af) {
      script = "hangul";
    } else if (code >= 0x0400 && code <= 0x04ff) {
      script = "cyrillic";
    } else if (code >= 0x0370 && code <= 0x03ff) {
      script = "greek";
    } else if (code >= 0x0900 && code <= 0x097f) {
      script = "devanagari";
    } else if (code >= 0x0600 && code <= 0x06ff) {
      script = "arabic";
    } else {
      script = "latin";
    }
    counts[script] = (counts[script] ?? 0) + 1;
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [script, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = script;
      bestCount = count;
    }
  }
  return best;
}

/** Hard-reject check for a single card. Returns a reason or null. */
function rejectionReason(card: ExerciseCard): string | null {
  if (card.type === "matching" && card.pairs.length < MIN_MATCHING_PAIRS) {
    return `matching has fewer than ${MIN_MATCHING_PAIRS} pairs`;
  }
  const answers = answersOf(card);
  const distractors = distractorsOf(card).map(norm);
  // Too-short answer: applies to every answer-bearing type.
  if (card.type !== "matching") {
    for (const answer of answers) {
      if (answer.trim().length < MIN_ANSWER_LENGTH) {
        return "answer shorter than two characters";
      }
    }
  }
  // Echo (answer is a word already in the question): only meaningful for
  // types whose question is a self-contained prompt. A CLOZE answer can
  // legitimately reappear elsewhere in its own sentence, so it is exempt.
  if (card.type === "free_text" || card.type === "picture_choice") {
    for (const answer of answers) {
      if (answerEchoesQuestion(card.question, answer)) {
        return "answer repeats a word from the question";
      }
    }
  }
  // Distractor equals a correct answer.
  const answerSet = new Set(answers.map(norm));
  if (distractors.some((distractor) => answerSet.has(distractor))) {
    return "a distractor equals the correct answer";
  }
  return null;
}

/** Soft warnings for a single passed card. */
function cardWarnings(card: ExerciseCard, index: number): QualityWarning[] {
  const out: QualityWarning[] = [];
  const distractors = distractorsOf(card);
  if (distractors.length > 1 && new Set(distractors.map(norm)).size === 1) {
    out.push({
      code: "all_distractors_identical",
      message: "all distractors are identical",
      cardIndex: index,
    });
  }
  if (card.type === "cloze" && card.distractors.length < 2) {
    out.push({
      code: "cloze_few_distractors",
      message: "cloze has fewer than two distractors",
      cardIndex: index,
    });
  }
  const firstAnswer = answersOf(card)[0];
  if (firstAnswer) {
    const qScript = dominantScript(card.question);
    const aScript = dominantScript(firstAnswer);
    if (qScript && aScript && qScript !== aScript) {
      out.push({
        code: "language_mismatch",
        message: `question (${qScript}) and answer (${aScript}) use different scripts`,
        cardIndex: index,
      });
    }
  }
  return out;
}

/**
 * Run the deterministic quality gate over parsed AI cards.
 *
 * @param cards - Structurally-valid cards from {@link parseGeneratedExercises}.
 * @returns The passed cards (order preserved), the rejected cards, and
 *          a list of non-fatal warnings.
 */
export function validateExerciseQuality(cards: ExerciseCard[]): QualityResult {
  const passed: ExerciseCard[] = [];
  const rejected: ExerciseCard[] = [];
  const warnings: QualityWarning[] = [];
  const seenQuestions = new Set<string>();
  const seenAnswers = new Set<string>();

  for (const card of cards) {
    const question = norm(card.question);
    const answerKey = answerSignature(card);
    if (
      (question && seenQuestions.has(question)) ||
      (answerKey && seenAnswers.has(answerKey))
    ) {
      rejected.push(card);
      continue;
    }
    const reason = rejectionReason(card);
    if (reason !== null) {
      rejected.push(card);
      continue;
    }
    if (question) seenQuestions.add(question);
    if (answerKey) seenAnswers.add(answerKey);
    passed.push(card);
  }

  // Per-card warnings on the passed set.
  passed.forEach((card, index) => warnings.push(...cardWarnings(card, index)));

  // Type-balance warnings.
  const distinctTypes = new Set(passed.map((card) => card.type));
  if (passed.length >= 2 && distinctTypes.size === 1) {
    warnings.push({
      code: "single_type",
      message: "all exercises are the same type; more variety is recommended",
    });
  } else if (passed.length >= 5 && distinctTypes.size < 2) {
    warnings.push({
      code: "low_type_variety",
      message: "five or more exercises but fewer than two types",
    });
  }

  return { passed, rejected, warnings };
}
