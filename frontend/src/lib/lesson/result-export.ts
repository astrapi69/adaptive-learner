/**
 * Lesson result export (#138).
 *
 * Pure helpers that turn a finished lesson's score + per-exercise
 * breakdown + weak-element history into a Markdown document the
 * learner can copy or download and paste into an AI assistant to
 * practice the weak spots.
 *
 * Kept free of React + i18n so it unit-tests in isolation: the
 * caller resolves the section labels via ``t()`` and passes them
 * in as a ``LessonResultLabels`` object. No storage reads here —
 * the data is already in scope on the summary screen.
 */

import type {
  ContentLesson,
  ContentLessonExercise,
  ElementError,
  LessonProgress,
  RawAnswer,
} from "../../storage/types";
import {
  deriveCanonicalAnswer,
  type ExerciseBreakdownEntry,
} from "../lesson-summary";

/** Localized section labels, resolved by the caller from the
 *  i18n catalog so this module stays language-agnostic. */
export interface LessonResultLabels {
  title: string;
  date: string;
  score: string;
  correctWord: string;
  mistakesHeading: string;
  noMistakes: string;
  question: string;
  yourAnswer: string;
  /** Shown for "your answer" when the user left it empty (#167 bug 1). */
  noAnswer: string;
  correctAnswer: string;
  weakAreasHeading: string;
}

/**
 * Human-readable text of the user's answer for the export, for the
 * exercise types whose answer is NOT a single typed string (#167 bug 1).
 *
 * Free-text + word-tiles already persist a coherent ``user_answer``; the
 * caller passes that through. Matching + picture-choice store only a
 * structured ``raw_answer``, so this reconstructs a readable form:
 *
 *   - picture_choice: the label of the chosen image.
 *   - matching: the user's pairings as ``left -> right, ...``.
 *
 * Returns ``null`` when nothing readable can be built (the caller then
 * renders the localized "(none)" placeholder).
 */
export function formatUserAnswer(
  exercise: ContentLessonExercise,
  rawAnswer: RawAnswer | null | undefined,
): string | null {
  if (!rawAnswer) return null;
  if (rawAnswer.kind === "picture_choice") {
    const label = exercise.images?.[rawAnswer.selected]?.label;
    return label && label.trim() ? label.trim() : null;
  }
  if (rawAnswer.kind === "matching") {
    const pairs = exercise.pairs ?? [];
    if (pairs.length === 0) return null;
    const byLeft = new Map<number, number>(rawAnswer.matches);
    const parts = pairs.map((pair, leftIdx) => {
      const rightIdx = byLeft.get(leftIdx);
      const right =
        rightIdx !== undefined ? (pairs[rightIdx]?.right ?? "?") : "?";
      return `${pair.left} -> ${right}`;
    });
    return parts.join(", ");
  }
  return null;
}

/** A still-unmastered element the learner should keep practicing. */
export interface WeakArea {
  label: string;
  count: number;
}

/**
 * Collapse a lesson's ``ElementError`` rows into a deduplicated,
 * most-missed-first list of weak areas.
 *
 * Only rows that are NOT yet mastered are surfaced (a mastered
 * element is no longer a weak spot). Rows are keyed by
 * ``element_key`` so the same word missed across several
 * exercises counts once, carrying its highest ``error_count``.
 * The label is the canonical answer (what to learn), falling
 * back to the element key when the answer text is empty.
 */
export function collectWeakAreas(
  errors: ElementError[],
  limit = 10,
): WeakArea[] {
  const byKey = new Map<string, WeakArea>();
  for (const err of errors) {
    if (err.mastered) continue;
    // #167 bug 2 — an entry with zero recorded errors is not a weak
    // spot (it produced the "(0x)" noise). Only surface real misses.
    const count = err.error_count ?? 0;
    if (count < 1) continue;
    // The label is the canonical answer (the whole concept to learn).
    // Do NOT fall back to ``element_key`` — that is a per-token key
    // (e.g. a single cloze blank), which produced the truncated
    // "klassische (1x)" fragments. Skip a row with no canonical text.
    const label = (err.correct_answer || "").trim();
    if (!label) continue;
    const existing = byKey.get(err.element_key);
    if (existing) {
      existing.count = Math.max(existing.count, count);
    } else {
      byKey.set(err.element_key, { label, count });
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/** ASCII, filesystem-safe slug for the download filename. */
function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/\u00df/g, "ss")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "lesson"
  );
}

/** ``lesson-result-<slug>-<yyyy-mm-dd>.<ext>`` — ASCII filename.
 *  Defaults to ``md``; the JSON export (#167 bug 3) passes ``json``. */
export function lessonResultFilename(
  lessonTitle: string,
  date: Date,
  ext: "md" | "json" = "md",
): string {
  const iso = date.toISOString().slice(0, 10);
  return `lesson-result-${slugify(lessonTitle)}-${iso}.${ext}`;
}

interface BuildArgs {
  lessonTitle: string;
  dateStr: string;
  correct: number;
  total: number;
  pct: number;
  breakdown: ExerciseBreakdownEntry[];
  weakAreas: WeakArea[];
  labels: LessonResultLabels;
}

/**
 * Render the lesson result as Markdown.
 *
 * Structure (labels localized):
 *
 *     # <title>: <lesson>
 *     <date>: <dateStr>
 *     <score>: c/t correct (p%)
 *
 *     ## <mistakes>
 *     - <question>: ...
 *       <yourAnswer>: ...   (only when a text answer was recorded)
 *       <correctAnswer>: ...
 *
 *     ## <weakAreas>
 *     - label (Nx)
 *
 * A perfect run renders the mistakes section as a single
 * "no mistakes" line. The weak-areas section is omitted entirely
 * when there is nothing unmastered to list.
 */
export function buildLessonResultMarkdown(args: BuildArgs): string {
  const {
    lessonTitle,
    dateStr,
    correct,
    total,
    pct,
    breakdown,
    weakAreas,
    labels,
  } = args;

  const lines: string[] = [];
  lines.push(`# ${labels.title}: ${lessonTitle}`);
  lines.push(`${labels.date}: ${dateStr}`);
  lines.push(
    `${labels.score}: ${correct}/${total} ${labels.correctWord} (${pct}%)`,
  );
  lines.push("");

  const mistakes = breakdown.filter(
    (entry) => entry.attempted && !entry.fullyCorrect,
  );
  lines.push(`## ${labels.mistakesHeading}`);
  if (mistakes.length === 0) {
    lines.push(`- ${labels.noMistakes}`);
  } else {
    for (const entry of mistakes) {
      lines.push(`- ${labels.question}: ${entry.title}`);
      // #167 bug 1 — ALWAYS show the learner's answer (with a
      // "(none)" placeholder when empty) so a mistake is never
      // reported as just the correct answer with no context.
      const answerText = entry.userAnswer?.trim()
        ? entry.userAnswer
        : labels.noAnswer;
      lines.push(`  ${labels.yourAnswer}: ${answerText}`);
      if (entry.canonicalAnswer) {
        lines.push(`  ${labels.correctAnswer}: ${entry.canonicalAnswer}`);
      }
    }
  }

  if (weakAreas.length > 0) {
    lines.push("");
    lines.push(`## ${labels.weakAreasHeading}`);
    for (const area of weakAreas) {
      lines.push(`- ${area.label} (${area.count}x)`);
    }
  }

  return lines.join("\n") + "\n";
}

/** One attempted exercise in the structured JSON export (#167 bug 3). */
export interface LessonResultJsonExercise {
  /** The exercise / step id. */
  question_id: string;
  prompt: string;
  /** Normalized, human-readable answer (#167 bug 1). Null when none
   *  could be reconstructed. */
  user_answer: string | null;
  /** Verbatim structured answer as persisted (#167 bug 4) — keeps the
   *  exact input traceable even after normalization. */
  raw_answer: RawAnswer | null;
  correct_answer: string;
  is_correct: boolean;
  /** Concept tags gathered from the exercise's referenced cards. */
  concept_tags: string[];
}

/** Structured, re-importable lesson result (#167 bug 3). */
export interface LessonResultJson {
  schema: "adaptive-learner.lesson-result";
  version: 1;
  lesson_title: string;
  /** ISO 8601 ``yyyy-mm-dd`` (#167 bug 5). */
  date: string;
  score: { correct: number; total: number; percent: number };
  exercises: LessonResultJsonExercise[];
  weak_areas: WeakArea[];
}

interface BuildJsonArgs {
  lesson: ContentLesson;
  progress: LessonProgress | null;
  dateStr: string;
  correct: number;
  total: number;
  pct: number;
  weakAreas: WeakArea[];
}

/**
 * Build the structured JSON twin of the Markdown export (#167 bug 3).
 *
 * Walks the lesson's attempted exercise steps and emits one entry each
 * with the prompt, the learner's normalized answer + the verbatim
 * ``raw_answer`` (#167 bug 4), the correct answer, the pass/fail flag,
 * and the concept tags of the exercise's cards. Re-importable for
 * AI-assisted follow-up learning; carries no user identity.
 */
export function buildLessonResultJson(args: BuildJsonArgs): LessonResultJson {
  const { lesson, progress, dateStr, correct, total, pct, weakAreas } = args;
  const stepResults = progress?.step_results ?? {};
  const cardsById = new Map(lesson.cards.map((card) => [card.id, card]));

  const exercises: LessonResultJsonExercise[] = [];
  for (const step of lesson.steps) {
    if (step.type !== "exercise" || !step.exercise) continue;
    const stepResult = stepResults[step.id];
    if (stepResult === undefined) continue;
    const exercise = step.exercise;
    const rawAnswer = stepResult.raw_answer ?? null;
    // Free-text + word-tiles persist a text user_answer directly;
    // matching + picture-choice reconstruct one from raw_answer.
    const userAnswer =
      stepResult.user_answer ?? formatUserAnswer(exercise, rawAnswer);
    const conceptTags = [
      ...new Set(
        exercise.card_ids.flatMap(
          (cardId) => cardsById.get(cardId)?.tags ?? [],
        ),
      ),
    ];
    exercises.push({
      question_id: step.id,
      prompt: exercise.prompt,
      user_answer: userAnswer,
      raw_answer: rawAnswer,
      correct_answer: deriveCanonicalAnswer(exercise),
      is_correct:
        stepResult.total > 0 && stepResult.correct === stepResult.total,
      concept_tags: conceptTags,
    });
  }

  return {
    schema: "adaptive-learner.lesson-result",
    version: 1,
    lesson_title: lesson.title,
    date: dateStr,
    score: { correct, total, percent: pct },
    exercises,
    weak_areas: weakAreas,
  };
}
