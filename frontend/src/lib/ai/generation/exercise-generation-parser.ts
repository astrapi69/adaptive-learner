/**
 * AIX-01 (EXP-036) — defensive parser for AI-generated exercises.
 *
 * LLM output is unreliable: it may be wrapped in Markdown fences, carry
 * prose around the JSON, include unknown exercise types, omit required
 * fields, or repeat cards. This parser turns a raw model reply into a
 * list of validated cards WITHOUT ever throwing — every malformed card
 * is skipped and counted, never crashes the run.
 *
 * It reuses the project's balanced-brace JSON extractor
 * (``lib/extract-json.ts``) for the fence/prose stripping, then validates
 * each card against the five schema exercise types. The output cards are
 * the AIX-01 intermediate shape (exercise-shaped ``cards[]`` straight
 * from the model); mapping them to ``ContentLessonExercise`` + the
 * quality gate is AIX-02.
 *
 * Library-grade: no app-state imports beyond the shared JSON helper.
 */

import { extractJsonObject, stripFences } from "../../utils/extract-json";
import {
  ALLOWED_EXERCISE_TYPES,
  type GeneratedExerciseType,
} from "./exercise-generation-prompt";

/** One {left, right} pair of a matching card. */
export interface MatchingPair {
  left: string;
  right: string;
}

/** One option of a picture-choice card. */
export interface ChoiceOption {
  label: string;
  is_correct: boolean;
}

/** One option of a multiple-choice card (text label + correctness flag).
 *  The schema stores it as ``{text, correct}``; the model-facing card mirrors
 *  picture_choice's ``is_correct`` and is mapped in ``cards-to-exercises``. */
export interface McOption {
  text: string;
  is_correct: boolean;
}

interface BaseCard {
  question: string;
}

export interface MatchingCard extends BaseCard {
  type: "matching";
  pairs: MatchingPair[];
}

export interface ClozeCard extends BaseCard {
  type: "cloze";
  answer: string;
  distractors: string[];
}

export interface FreeTextCard extends BaseCard {
  type: "free_text";
  accepts: string[];
  distractors: string[];
}

export interface WordTilesCard extends BaseCard {
  type: "word_tiles";
  answer: string;
}

export interface PictureChoiceCard extends BaseCard {
  type: "picture_choice";
  options: ChoiceOption[];
}

export interface MultipleChoiceCard extends BaseCard {
  type: "multiple_choice";
  options: McOption[];
  /** false = single-choice (exactly one correct); true = select-all (>= 1
   *  correct, graded by exact set). */
  multiple: boolean;
}

/** A validated, schema-shaped generated exercise card. */
export type ValidCard =
  | MatchingCard
  | ClozeCard
  | FreeTextCard
  | WordTilesCard
  | PictureChoiceCard
  | MultipleChoiceCard;

/** Result of parsing a raw AI exercise-generation reply. */
export interface ExerciseGenerationParseResult {
  /** The cards that passed type validation, de-duplicated. */
  cards: ValidCard[];
  /** How many candidate cards were dropped (invalid + duplicate). */
  skipped: number;
  /** Human-readable reasons, one per dropped/notable candidate. */
  errors: string[];
}

const MIN_MATCHING_PAIRS = 3;
const MIN_CHOICE_OPTIONS = 3;
const MIN_MC_OPTIONS = 2;

/** A non-empty trimmed string, or null. */
function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Array of non-empty strings (drops empties), or [] when not an array. */
function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(cleanString)
    .filter((entry): entry is string => entry !== null);
}

/** Coerce a truthy/"true" value to a boolean (the model is loose here). */
function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function validateMatching(raw: Record<string, unknown>, question: string): MatchingCard | string {
  const rawPairs = Array.isArray(raw.pairs) ? raw.pairs : [];
  const pairs: MatchingPair[] = [];
  for (const entry of rawPairs) {
    if (!entry || typeof entry !== "object") continue;
    const bag = entry as Record<string, unknown>;
    const left = cleanString(bag.left);
    const right = cleanString(bag.right);
    if (left && right) pairs.push({ left, right });
  }
  if (pairs.length < MIN_MATCHING_PAIRS) {
    return `matching: needs >= ${MIN_MATCHING_PAIRS} complete pairs, got ${pairs.length}`;
  }
  return { type: "matching", question, pairs };
}

function validateCloze(raw: Record<string, unknown>, question: string): ClozeCard | string {
  if (!question.includes("___")) return "cloze: question has no ___ blank";
  const answer = cleanString(raw.answer);
  if (!answer) return "cloze: missing answer";
  const distractors = cleanStringArray(raw.distractors);
  return { type: "cloze", question, answer, distractors };
}

function validateFreeText(raw: Record<string, unknown>, question: string): FreeTextCard | string {
  const accepts = cleanStringArray(raw.accepts);
  if (accepts.length < 1) return "free_text: needs >= 1 accepted answer";
  return { type: "free_text", question, accepts, distractors: cleanStringArray(raw.distractors) };
}

function validateWordTiles(raw: Record<string, unknown>, question: string): WordTilesCard | string {
  const answer = cleanString(raw.answer);
  if (!answer) return "word_tiles: missing answer";
  if (answer.split(/\s+/).filter(Boolean).length < 2) {
    return "word_tiles: answer must be at least two tokens";
  }
  return { type: "word_tiles", question, answer };
}

function validatePictureChoice(
  raw: Record<string, unknown>,
  question: string,
): PictureChoiceCard | string {
  const rawOptions = Array.isArray(raw.options) ? raw.options : [];
  const options: ChoiceOption[] = [];
  for (const entry of rawOptions) {
    if (!entry || typeof entry !== "object") continue;
    const bag = entry as Record<string, unknown>;
    const label = cleanString(bag.label);
    if (label) options.push({ label, is_correct: asBool(bag.is_correct) });
  }
  if (options.length < MIN_CHOICE_OPTIONS) {
    return `picture_choice: needs >= ${MIN_CHOICE_OPTIONS} options, got ${options.length}`;
  }
  if (!options.some((option) => option.is_correct)) {
    return "picture_choice: no option marked correct";
  }
  return { type: "picture_choice", question, options };
}

function validateMultipleChoice(
  raw: Record<string, unknown>,
  question: string,
): MultipleChoiceCard | string {
  const rawOptions = Array.isArray(raw.options) ? raw.options : [];
  const options: McOption[] = [];
  for (const entry of rawOptions) {
    if (!entry || typeof entry !== "object") continue;
    const bag = entry as Record<string, unknown>;
    // Accept ``text`` (schema/MC) or ``label`` (a lenient alias the model
    // sometimes reuses from picture_choice) so a good card is not lost.
    const text = cleanString(bag.text) ?? cleanString(bag.label);
    if (text) options.push({ text, is_correct: asBool(bag.is_correct) });
  }
  if (options.length < MIN_MC_OPTIONS) {
    return `multiple_choice: needs >= ${MIN_MC_OPTIONS} options, got ${options.length}`;
  }
  const texts = options.map((option) => option.text.toLowerCase());
  if (new Set(texts).size !== texts.length) {
    return "multiple_choice: option texts must be unique";
  }
  const correctCount = options.filter((option) => option.is_correct).length;
  if (correctCount < 1) {
    return "multiple_choice: no option marked correct";
  }
  // ``multiple`` is the model's stated intent; when absent, infer it from the
  // correct-count so a select-all card without the flag is still salvaged.
  const multiple =
    raw.multiple !== undefined ? asBool(raw.multiple) : correctCount > 1;
  if (!multiple && correctCount !== 1) {
    return "multiple_choice: single-choice needs exactly one correct option";
  }
  return { type: "multiple_choice", question, options, multiple };
}

/** Validate one raw card object into a {@link ValidCard} or an error
 *  string explaining why it was dropped. */
function validateCard(raw: unknown): ValidCard | string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return "card is not an object";
  }
  const bag = raw as Record<string, unknown>;
  const type = cleanString(bag.type);
  if (!type) return "card has no type";
  if (!ALLOWED_EXERCISE_TYPES.includes(type as GeneratedExerciseType)) {
    return `unknown exercise type: ${type}`;
  }
  const question = cleanString(bag.question);
  if (!question) return `${type}: missing question`;

  switch (type as GeneratedExerciseType) {
    case "matching":
      return validateMatching(bag, question);
    case "cloze":
      return validateCloze(bag, question);
    case "free_text":
      return validateFreeText(bag, question);
    case "word_tiles":
      return validateWordTiles(bag, question);
    case "picture_choice":
      return validatePictureChoice(bag, question);
    case "multiple_choice":
      return validateMultipleChoice(bag, question);
    default:
      return `unknown exercise type: ${type}`;
  }
}

/** Stable signature for duplicate detection (type + question + payload). */
function cardSignature(card: ValidCard): string {
  return JSON.stringify(card).toLowerCase();
}

/**
 * Pull the ``cards[]`` array out of a raw model reply. Accepts an object
 * with a ``cards`` array, a bare top-level array, or prose-wrapped /
 * fenced variants of either. Returns ``null`` when nothing usable is
 * found.
 */
export function extractCardsArray(raw: string): unknown[] | null {
  const stripped = stripFences(raw.trim());
  // Bare top-level array.
  try {
    const direct: unknown = JSON.parse(stripped);
    if (Array.isArray(direct)) return direct;
    if (direct && typeof direct === "object" && Array.isArray((direct as Record<string, unknown>).cards)) {
      return (direct as Record<string, unknown>).cards as unknown[];
    }
  } catch {
    /* fall through to balanced-object scan */
  }
  // Object (possibly prose-wrapped) carrying a cards array.
  const obj = extractJsonObject(raw);
  if (obj && Array.isArray(obj.cards)) return obj.cards as unknown[];
  // Last resort: the largest balanced array literal in the text.
  for (const candidate of findBalancedArrays(stripped)) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/** Balanced ``[...]`` scanner (string/escape-aware), longest first. */
function findBalancedArrays(input: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < input.length; i++) {
    if (input[i] !== "[") continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = i; j < input.length; j++) {
      const ch = input[j];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          results.push(input.slice(i, j + 1));
          break;
        }
      }
    }
  }
  results.sort((a, b) => b.length - a.length);
  return results;
}

/**
 * Parse a raw AI exercise-generation reply into validated cards.
 *
 * Never throws: a structurally broken reply yields
 * ``{ cards: [], skipped: 0, errors: ["..."] }``; mixed-quality input
 * keeps the good cards and skips the rest with a reason each. Duplicate
 * cards (identical type + content) are dropped and counted.
 *
 * @param raw - The model's raw text reply.
 * @returns Validated cards plus skip count and error reasons.
 */
export function parseGeneratedExercises(raw: string): ExerciseGenerationParseResult {
  const errors: string[] = [];
  if (cleanString(raw) === null) {
    return { cards: [], skipped: 0, errors: ["empty AI response"] };
  }
  const candidates = extractCardsArray(raw);
  if (candidates === null) {
    return { cards: [], skipped: 0, errors: ["no JSON cards array found in AI response"] };
  }

  const cards: ValidCard[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const candidate of candidates) {
    const validated = validateCard(candidate);
    if (typeof validated === "string") {
      skipped++;
      errors.push(validated);
      continue;
    }
    const signature = cardSignature(validated);
    if (seen.has(signature)) {
      skipped++;
      errors.push(`duplicate ${validated.type} card dropped`);
      continue;
    }
    seen.add(signature);
    cards.push(validated);
  }

  return { cards, skipped, errors };
}
