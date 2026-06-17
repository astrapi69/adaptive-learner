/**
 * EXP-033 / AIV-01 — set-wide, batched AI content validation.
 *
 * The v1.44.0 ``lib/content/ai-content-validator.ts`` reviews a whole
 * lesson set in one shot and returns aggregated issue lists. EXP-033
 * needs a **per-card, batched** review so the report UI can pin each
 * issue to a single card and so large sets stay inside a sane token
 * budget.
 *
 * This module is PURE (prompt building + defensive parsing + batch
 * splitting); the actual provider call runs through the existing
 * browser-direct ``aiComplete`` (Dexie) / backend route (API). Keeping
 * it pure means the prompt + parser are unit-testable without any I/O
 * or provider mock.
 *
 * The prompt is authored in German on purpose: it is the grader
 * instruction sent to the model, never shown to the learner, and the
 * project's primary content language is German. Issue/suggestion text
 * the model returns is echoed back verbatim in the report.
 */

import { stripFences } from "../extract-json";

/** The minimal card shape the validator reads. Structurally a subset of
 *  ``ContentLessonCard`` so callers pass cards straight through. */
export interface ValidationCard {
  id: string;
  front: string;
  back: string;
  notes?: string | null;
}

/** One problem the AI flagged on a card field. */
export interface ValidationIssue {
  /** Which card field the problem is on ("front" | "back" | "notes" | …). */
  field: string;
  /** Human-readable description of what is wrong. */
  problem: string;
  /** The corrected value or guidance. */
  suggestion: string;
}

/** Per-card validation outcome. ``ok === true`` ⇒ ``issues`` is empty. */
export interface ValidationResult {
  card_id: string;
  ok: boolean;
  issues: ValidationIssue[];
}

/** Thrown when a non-trivial response contains no recoverable JSON array.
 *  An empty/whitespace response or a literal ``[]`` is NOT an error — it
 *  means "all cards OK" and yields ``[]``. */
export class ValidationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationParseError";
  }
}

/** Max cards per provider call — the cost cap from EXP-033 §3.3. */
export const VALIDATION_BATCH_SIZE = 10;

/**
 * Split ``cards`` into batches of at most ``batchSize`` (default 10).
 * 25 cards → ``[10, 10, 5]``. An empty input yields ``[]``.
 */
export function splitIntoBatches<T>(
  cards: T[],
  batchSize: number = VALIDATION_BATCH_SIZE,
): T[][] {
  const size = Math.max(1, Math.floor(batchSize));
  const batches: T[][] = [];
  for (let i = 0; i < cards.length; i += size) {
    batches.push(cards.slice(i, i + size));
  }
  return batches;
}

/**
 * Build the grader prompt for ONE batch of cards.
 *
 * @param cards - up to {@link VALIDATION_BATCH_SIZE} cards.
 * @param sourceLanguage - language the learner already speaks (card backs).
 * @param targetLanguage - language being learned (card fronts).
 * @param level - CEFR level ("A1", "B2", …) for level-fit judgement.
 */
export function buildValidationPrompt(
  cards: ValidationCard[],
  sourceLanguage: string,
  targetLanguage: string,
  level: string,
): string {
  const cardJson = JSON.stringify(
    cards.map((c) => ({
      card_id: c.id,
      front: c.front,
      back: c.back,
      notes: c.notes ?? undefined,
    })),
    null,
    0,
  );

  return [
    "Du bist ein Sprachlehrer und Qualitaetspruefer.",
    `Pruefe diese Lernkarten (Quellsprache: ${sourceLanguage}, ` +
      `Zielsprache: ${targetLanguage}, Level: ${level}).`,
    "Das Feld 'front' ist in der Zielsprache, 'back' und 'notes' in der Quellsprache.",
    "",
    "Pro Karte pruefen:",
    "1. Uebersetzung korrekt?",
    "2. Artikel korrekt?",
    "3. Konjugation korrekt?",
    "4. Akzente vollstaendig?",
    "5. Distraktoren plausibel aber eindeutig falsch?",
    "6. Cloze-Luecke hat genau eine korrekte Antwort?",
    "",
    "Antworte NUR als JSON Array, exakt in dieser Form:",
    '[{"card_id": "...", "ok": true, "issues": []},',
    ' {"card_id": "...", "ok": false, "issues": ' +
      '[{"field": "back", "problem": "...", "suggestion": "..."}]}]',
    "Eine Karte ohne Probleme hat ok=true und issues=[].",
    "Schreibe 'problem' und 'suggestion' in der Quellsprache.",
    "Keine Erklaerungen ausserhalb des JSON.",
    "",
    "Karten:",
    cardJson,
  ].join("\n");
}

/**
 * Parse a raw AI response into per-card results.
 *
 * Robust against the usual model output noise:
 *   - markdown ```` ```json ```` fences,
 *   - prose before/after the array,
 *   - trailing commas,
 *   - a truncated (cut-off) array — complete objects are recovered.
 *
 * An empty/whitespace response or a literal ``[]`` returns ``[]`` ("all
 * OK"). A non-trivial response with no recoverable array throws
 * {@link ValidationParseError} so the caller can surface "could not
 * parse" rather than silently reporting zero issues.
 */
export function parseValidationResponse(text: string): ValidationResult[] {
  if (typeof text !== "string") {
    throw new ValidationParseError("Response was not a string");
  }
  const stripped = stripFences(text.trim());
  if (stripped.length === 0) return [];

  const arrayText = findFirstBalancedArray(stripped);
  if (arrayText !== null) {
    // 1. straight parse, 2. trailing-comma cleanup, 3. truncation recovery.
    const direct = tryParseArray(arrayText);
    if (direct !== null) return normaliseResults(direct);

    const cleaned = tryParseArray(removeTrailingCommas(arrayText));
    if (cleaned !== null) return normaliseResults(cleaned);

    const recovered = recoverObjectsFromTruncated(arrayText);
    if (recovered.length > 0) return normaliseResults(recovered);

    throw new ValidationParseError("Response array could not be parsed");
  }

  // No balanced array closed (truncated mid-stream). If an array opened,
  // recover whatever complete objects the model finished emitting.
  const open = stripped.indexOf("[");
  if (open !== -1) {
    const recovered = recoverObjectsFromTruncated(stripped.slice(open));
    if (recovered.length > 0) return normaliseResults(recovered);
  }
  throw new ValidationParseError("No JSON array found in response");
}

// --- internals -------------------------------------------------------------

/** Find the first balanced ``[...]`` substring, respecting strings +
 *  escapes so brackets inside quoted values don't unbalance the scan.
 *  Returns the substring or ``null`` if none closes. */
function findFirstBalancedArray(input: string): string | null {
  const start = input.indexOf("[");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < input.length; i++) {
    const ch = input[i];
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
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return null;
}

function tryParseArray(candidate: string): unknown[] | null {
  try {
    const data: unknown = JSON.parse(candidate);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** Remove trailing commas before ``]`` / ``}`` (a common model slip).
 *  String-aware so a comma inside a quoted value is left alone. */
function removeTrailingCommas(input: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escape) {
      out += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (!inString && ch === ",") {
      // peek to the next non-whitespace char
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j++;
      if (input[j] === "]" || input[j] === "}") continue; // drop the comma
    }
    out += ch;
  }
  return out;
}

/** Recover every complete top-level ``{...}`` object from a (possibly
 *  truncated) array body. Lets a cut-off response still yield the cards
 *  the model finished judging. */
function recoverObjectsFromTruncated(arrayText: string): unknown[] {
  const objects: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let objStart = -1;
  for (let i = 0; i < arrayText.length; i++) {
    const ch = arrayText[i];
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
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        const parsed = tryParseObject(arrayText.slice(objStart, i + 1));
        if (parsed !== null) objects.push(parsed);
        objStart = -1;
      }
    }
  }
  return objects;
}

function tryParseObject(candidate: string): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(candidate);
    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Coerce arbitrary parsed rows into validated {@link ValidationResult}s,
 *  dropping rows with no usable ``card_id``. */
function normaliseResults(rows: unknown[]): ValidationResult[] {
  const out: ValidationResult[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const rec = row as Record<string, unknown>;
    const cardId = typeof rec.card_id === "string" ? rec.card_id : "";
    if (!cardId) continue;
    const issues = normaliseIssues(rec.issues);
    // ``ok`` defaults to "no issues"; an explicit false with no issues is
    // honoured, an explicit true with issues is corrected to false.
    let ok = typeof rec.ok === "boolean" ? rec.ok : issues.length === 0;
    if (issues.length > 0) ok = false;
    out.push({ card_id: cardId, ok, issues });
  }
  return out;
}

function normaliseIssues(value: unknown): ValidationIssue[] {
  if (!Array.isArray(value)) return [];
  const issues: ValidationIssue[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const field = typeof rec.field === "string" ? rec.field : "";
    const problem = typeof rec.problem === "string" ? rec.problem : "";
    const suggestion = typeof rec.suggestion === "string" ? rec.suggestion : "";
    if (!field && !problem && !suggestion) continue;
    issues.push({ field, problem, suggestion });
  }
  return issues;
}
