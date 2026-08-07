/**
 * #2355 — text-only extension exercises in the AI generation pipeline.
 *
 * The core generator produces the six schema exercise types. The app has
 * ALSO adopted six ``ext:al-*`` extension types; four of them are text-only
 * (no assets) and map cleanly onto book chapters:
 *
 *   - ``ext:al-reading-comprehension`` — a passage plus sub-questions.
 *   - ``ext:al-graded-quiz``           — a scored end-of-lesson summary quiz.
 *   - ``ext:al-categorization``        — sort terms into concept buckets.
 *   - ``ext:al-error-correction``      — mark + fix the wrong token.
 *
 * This module is the extension half of the pipeline: it builds an
 * {@link ExtensionCard} from the model's raw JSON (STRUCTURAL shaping into
 * ``ext_payload``), validates that payload by REUSING the shipped
 * ``*PayloadErrors`` validators (Library-First — the exact rules the
 * renderers + load guard enforce), and applies a SEPARATE per-type budget so
 * a costly extension never crowds out the core drill types.
 *
 * The two media extensions (``ext:al-dictation`` + ``ext:al-image-description``)
 * are intentionally NOT here — they need assets and belong to a later track.
 *
 * Library-grade: pure, no app-state / network imports.
 */

import type { ContentLessonExercise } from "../../../storage/types";
import { asBool, cleanString, cleanStringArray } from "./card-fields";
import {
  CATEGORIZATION_EXT_TYPE,
  categorizationPayloadErrors,
} from "../../exercises/payload/categorization";
import {
  ERROR_CORRECTION_EXT_TYPE,
  errorCorrectionPayloadErrors,
} from "../../exercises/payload/error-correction";
import {
  READING_COMPREHENSION_EXT_TYPE,
  readingComprehensionPayloadErrors,
  type RcQuestion,
} from "../../exercises/payload/reading-comprehension";
import {
  GRADED_QUIZ_EXT_TYPE,
  gradedQuizPayloadErrors,
  type GqQuestion,
} from "../../exercises/payload/graded-quiz";

export {
  CATEGORIZATION_EXT_TYPE,
  ERROR_CORRECTION_EXT_TYPE,
  READING_COMPREHENSION_EXT_TYPE,
  GRADED_QUIZ_EXT_TYPE,
};

/** The four text-only extension types the generator can produce. */
export const TEXT_EXTENSION_TYPES = [
  READING_COMPREHENSION_EXT_TYPE,
  GRADED_QUIZ_EXT_TYPE,
  CATEGORIZATION_EXT_TYPE,
  ERROR_CORRECTION_EXT_TYPE,
] as const;

export type TextExtensionType = (typeof TEXT_EXTENSION_TYPES)[number];

const TEXT_EXTENSION_TYPE_SET: ReadonlySet<string> = new Set(TEXT_EXTENSION_TYPES);

/** True when ``type`` is one of the four generatable text extensions. */
export function isTextExtensionType(type: string): type is TextExtensionType {
  return TEXT_EXTENSION_TYPE_SET.has(type);
}

/**
 * A generated extension exercise card: the ``ext:al-*`` type, the exercise
 * prompt (``question``), and the opaque ``ext_payload`` the extension's
 * validator + renderer interpret. Parallel to the core {@link ValidCard}
 * shapes but carried on a separate union so the core distribution never sees
 * it.
 */
export interface ExtensionCard {
  type: TextExtensionType;
  question: string;
  ext_payload: Record<string, unknown>;
}

/** Narrow a generated card to an {@link ExtensionCard}. */
export function isExtensionCard(card: { type: string }): card is ExtensionCard {
  return isTextExtensionType(card.type);
}

/** Build one reading-comprehension / graded-quiz sub-question from raw JSON.
 *  ``withPoints`` adds the graded-quiz ``points`` (+ optional partial credit);
 *  the correctness flag reads ``correct`` OR the lenient ``is_correct`` alias. */
function buildSubQuestion(raw: unknown, withPoints: boolean): RcQuestion | GqQuestion {
  const bag = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const prompt = cleanString(bag.prompt) ?? "";
  const type = cleanString(bag.type) === "free_text" ? "free_text" : "multiple_choice";
  const base: RcQuestion =
    type === "multiple_choice"
      ? {
          prompt,
          type,
          options: (Array.isArray(bag.options) ? bag.options : [])
            .map((entry) => {
              const opt = (entry && typeof entry === "object" ? entry : {}) as Record<
                string,
                unknown
              >;
              const text = cleanString(opt.text);
              const correct =
                opt.correct !== undefined ? asBool(opt.correct) : asBool(opt.is_correct);
              return text ? { text, correct } : null;
            })
            .filter((opt): opt is { text: string; correct: boolean } => opt !== null),
        }
      : { prompt, type, accept: cleanStringArray(bag.accept) };
  if (!withPoints) return base;
  const rawPoints = bag.points;
  const points = typeof rawPoints === "number" && rawPoints > 0 ? rawPoints : 1;
  const gq: GqQuestion = { ...base, points };
  if (type === "multiple_choice" && asBool(bag.partial_credit)) gq.partial_credit = true;
  return gq;
}

/** Passing bar applied to a generated graded quiz when the model omits it or
 *  gives a trivially-passable (<= 0) value (#2364). Matches the extension
 *  wizard's blank default so authored and generated quizzes agree. */
const DEFAULT_GRADED_QUIZ_PASS_THRESHOLD = 60;

/** Per-extension-type ``ext_payload`` builder from the model's raw card. */
const EXT_PAYLOAD_BUILDERS: Record<
  TextExtensionType,
  (raw: Record<string, unknown>) => Record<string, unknown>
> = {
  [READING_COMPREHENSION_EXT_TYPE]: (raw) => ({
    passage: cleanString(raw.passage) ?? "",
    questions: (Array.isArray(raw.questions) ? raw.questions : []).map((q) =>
      buildSubQuestion(q, false),
    ),
  }),
  [GRADED_QUIZ_EXT_TYPE]: (raw) => ({
    // #2364 — a quiz everyone passes is not a test. An omitted or <= 0
    // pass_threshold is schema-valid but always-pass, so normalize it to a
    // real passing bar (the wizard's default). Deterministic; no prompt hint.
    pass_threshold:
      typeof raw.pass_threshold === "number" && raw.pass_threshold > 0
        ? raw.pass_threshold
        : DEFAULT_GRADED_QUIZ_PASS_THRESHOLD,
    questions: (Array.isArray(raw.questions) ? raw.questions : []).map((q) =>
      buildSubQuestion(q, true),
    ),
  }),
  [CATEGORIZATION_EXT_TYPE]: (raw) => ({
    categories: (Array.isArray(raw.categories) ? raw.categories : [])
      .map((entry) => {
        const bag = (entry && typeof entry === "object" ? entry : {}) as Record<
          string,
          unknown
        >;
        return { name: cleanString(bag.name) ?? "", items: cleanStringArray(bag.items) };
      })
      .filter((bucket) => bucket.name.length > 0 || bucket.items.length > 0),
  }),
  [ERROR_CORRECTION_EXT_TYPE]: (raw) => ({
    tokens: cleanStringArray(raw.tokens),
    error_index: typeof raw.error_index === "number" ? Math.trunc(raw.error_index) : 0,
    accept: cleanStringArray(raw.accept),
  }),
};

/**
 * Build an {@link ExtensionCard} from a raw model card (STRUCTURAL shaping
 * only; the deep payload check is {@link extensionPayloadErrors}, run by the
 * quality gate). Returns the card, or an error string when the type is not a
 * generatable text extension.
 */
export function buildExtensionCard(
  raw: Record<string, unknown>,
  type: string,
  question: string,
): ExtensionCard | string {
  if (!isTextExtensionType(type)) return `unsupported extension type: ${type}`;
  return { type, question, ext_payload: EXT_PAYLOAD_BUILDERS[type](raw) };
}

const PAYLOAD_VALIDATORS: Record<
  TextExtensionType,
  (exercise: ContentLessonExercise) => string[]
> = {
  [READING_COMPREHENSION_EXT_TYPE]: readingComprehensionPayloadErrors,
  [GRADED_QUIZ_EXT_TYPE]: gradedQuizPayloadErrors,
  [CATEGORIZATION_EXT_TYPE]: categorizationPayloadErrors,
  [ERROR_CORRECTION_EXT_TYPE]: errorCorrectionPayloadErrors,
};

/**
 * QUALITY GATE half: validate an extension card's payload by reusing the
 * shipped ``*PayloadErrors`` validator for its type. Returns the (possibly
 * empty) list of human-readable errors — non-empty means the card is dropped.
 */
export function extensionPayloadErrors(card: ExtensionCard): string[] {
  const exercise = {
    id: "gen-ext",
    type: card.type,
    prompt: card.question,
    card_ids: [],
    distractors: [],
    ext_payload: card.ext_payload,
  } as unknown as ContentLessonExercise;
  return PAYLOAD_VALIDATORS[card.type](exercise);
}

/**
 * Separate per-lesson budget for extension exercises (#2355). Extensions are
 * costlier + slower to answer than a cloze, so they get their own small caps
 * instead of the core percentage split: at most ONE reading-comprehension and
 * ONE graded-quiz (an end-of-lesson summary), a couple of the lighter sorts.
 * A true set/part-level graded quiz is a separate mechanism (out of scope).
 */
export const EXTENSION_BUDGET: Record<TextExtensionType, number> = {
  [READING_COMPREHENSION_EXT_TYPE]: 1,
  [GRADED_QUIZ_EXT_TYPE]: 1,
  [CATEGORIZATION_EXT_TYPE]: 2,
  [ERROR_CORRECTION_EXT_TYPE]: 3,
};

/** Outcome of applying the extension budget. */
export interface ExtensionCapResult {
  /** The surviving extension cards, in first-seen order. */
  cards: ExtensionCard[];
  /** How many cards the budget dropped. */
  dropped: number;
}

/**
 * Apply {@link EXTENSION_BUDGET}: keep at most N cards of each extension type
 * (first-seen order), pushing the rest out. Pure — never mutates the input.
 */
export function capExtensionCards(
  cards: ExtensionCard[],
  budget: Record<TextExtensionType, number> = EXTENSION_BUDGET,
): ExtensionCapResult {
  const counts = new Map<TextExtensionType, number>();
  const kept: ExtensionCard[] = [];
  let dropped = 0;
  for (const card of cards) {
    const used = counts.get(card.type) ?? 0;
    if (used >= budget[card.type]) {
      dropped += 1;
      continue;
    }
    counts.set(card.type, used + 1);
    kept.push(card);
  }
  return { cards: kept, dropped };
}
