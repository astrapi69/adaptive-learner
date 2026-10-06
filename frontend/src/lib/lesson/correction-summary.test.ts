/**
 * #3575 - the correction summary: which mistakes of a lesson run are
 * corrected by now, with the first answer, the correct one and (for those
 * still open) the exercise's explanation.
 *
 * "Corrected" is decided exactly as the correction block and the compact
 * summary decide it (``openFailedExercises`` over the live SRS rows), so
 * every view shows the same verdict for the same run.
 */
import { describe, expect, it } from "vitest";

import type { ContentLesson, ElementError, LessonProgress } from "../../storage/types";
import { buildCorrectionSummary, collectRunMistakes } from "./correction-summary";

function step(id: string, accept: string, explanation?: string) {
  return {
    id,
    type: "exercise",
    title: null,
    body: null,
    exercise: {
      id: `ex-${id}`,
      type: "free_text",
      prompt: `Translate ${id}`,
      card_ids: [],
      accept: [accept],
      distractors: [],
      ...(explanation ? { explanation } : {}),
    },
  };
}

const LESSON = {
  id: "l1",
  title: "Greetings",
  estimated_minutes: 5,
  cards: [],
  steps: [
    { id: "t1", type: "theory", title: "Intro", body: "Hi", exercise: null },
    step("s1", "hola", "Spanish greets with hola."),
    step("s2", "adiós"),
    step("s3", "gracias"),
  ],
} as unknown as ContentLesson;

const PROGRESS = {
  step_results: {
    s1: { correct: 0, total: 1, attempts: 1, user_answer: "ola" },
    s2: { correct: 0, total: 1, attempts: 1, user_answer: "adios" },
    s3: { correct: 1, total: 1, attempts: 1, user_answer: "gracias" },
  },
  score_correct: 1,
  score_total: 3,
} as unknown as LessonProgress;

function row(exerciseId: string, corrected: boolean): ElementError {
  return {
    exercise_id: exerciseId,
    element_key: `${exerciseId}-k`,
    correct_streak: corrected ? 1 : 0,
    mastered: false,
    error_count: 1,
  } as ElementError;
}

describe("collectRunMistakes (#3575)", () => {
  it("lists the run's failed exercises with first answer and correct answer, in lesson order", () => {
    const { mistakes } = collectRunMistakes(LESSON, PROGRESS);
    expect(mistakes.map((m) => [m.stepId, m.firstAnswer, m.correctAnswer])).toEqual([
      ["s1", "ola", "hola"],
      ["s2", "adios", "adiós"],
    ]);
    expect(mistakes[0].question).toBe("Translate s1");
  });

  it("counts the first try over the exercises the run answered", () => {
    expect(collectRunMistakes(LESSON, PROGRESS).firstTry).toEqual({ correct: 1, total: 3 });
  });

  it.each([
    ["no progress", null],
    ["a clean run", { ...PROGRESS, step_results: { s1: { correct: 1, total: 1, attempts: 1 } } }],
  ])("has no mistakes for %s", (_name, progress) => {
    expect(collectRunMistakes(LESSON, progress as LessonProgress | null).mistakes).toEqual([]);
  });
});

describe("buildCorrectionSummary (#3575)", () => {
  const run = collectRunMistakes(LESSON, PROGRESS);

  it("marks a mistake corrected when its live rows were answered right since", () => {
    const summary = buildCorrectionSummary(run, [row("ex-s1", true), row("ex-s2", false)]);
    expect(summary.entries.map((e) => [e.stepId, e.corrected])).toEqual([
      ["s1", true],
      ["s2", false],
    ]);
    expect([summary.correctedCount, summary.total]).toEqual([1, 2]);
  });

  it("keeps a mistake open while it has no live row yet, as the correction block does", () => {
    const summary = buildCorrectionSummary(run, []);
    expect(summary.entries.map((e) => e.corrected)).toEqual([false, false]);
  });

  it("carries the exercise's own explanation, and none once the mistake is corrected", () => {
    const open = buildCorrectionSummary(run, [row("ex-s1", false), row("ex-s2", false)]);
    expect(open.entries.map((e) => e.explanation)).toEqual(["Spanish greets with hola.", null]);
    const fixed = buildCorrectionSummary(run, [row("ex-s1", true), row("ex-s2", false)]);
    expect(fixed.entries[0].explanation).toBeNull();
  });

  it("passes the first-try tally through", () => {
    expect(buildCorrectionSummary(run, []).firstTry).toEqual({ correct: 1, total: 3 });
  });
});
