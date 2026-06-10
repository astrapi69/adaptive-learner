import { describe, it, expect } from "vitest";

import type { ContentLessonExercise, ElementError } from "../../storage/types";
import type { ExerciseBreakdownEntry } from "../lesson-summary";
import {
  buildLessonResultMarkdown,
  collectWeakAreas,
  formatUserAnswer,
  lessonResultFilename,
  type LessonResultLabels,
} from "./result-export";

const LABELS: LessonResultLabels = {
  title: "Lesson result",
  date: "Date",
  score: "Score",
  correctWord: "correct",
  mistakesHeading: "Mistakes",
  noMistakes: "No mistakes - perfect run!",
  question: "Question",
  yourAnswer: "Your answer",
  noAnswer: "(none)",
  correctAnswer: "Correct",
  weakAreasHeading: "Weak areas",
};

function entry(over: Partial<ExerciseBreakdownEntry>): ExerciseBreakdownEntry {
  return {
    stepId: "s1",
    title: "Translate 'hello'",
    exerciseType: "free_text",
    attempted: true,
    correct: 0,
    total: 1,
    fullyCorrect: false,
    canonicalAnswer: "hola",
    userAnswer: "ola",
    ...over,
  };
}

function elementError(over: Partial<ElementError>): ElementError {
  return {
    id: "e1",
    user_id: "u1",
    set_id: "set",
    lesson_id: "01.json",
    exercise_id: "ex1",
    element_key: "k1",
    element_type: "vocabulary",
    user_answer: "ola",
    correct_answer: "hola",
    error_count: 2,
    correct_streak: 0,
    last_error_at: null,
    last_attempt_at: "2026-06-09",
    mastered: false,
    mastered_at: null,
    created_at: "2026-06-09",
    updated_at: "2026-06-09",
    ...over,
  } as ElementError;
}

describe("buildLessonResultMarkdown", () => {
  it("renders header, mistakes with your/correct answer, and weak areas", () => {
    const md = buildLessonResultMarkdown({
      lessonTitle: "Greetings",
      dateStr: "2026-06-09",
      correct: 4,
      total: 6,
      pct: 67,
      breakdown: [
        entry({}),
        entry({
          stepId: "s2",
          fullyCorrect: true,
          correct: 1,
          title: "ok one",
        }),
      ],
      weakAreas: [{ label: "hola", count: 2 }],
      labels: LABELS,
    });
    expect(md).toContain("# Lesson result: Greetings");
    expect(md).toContain("Date: 2026-06-09");
    expect(md).toContain("Score: 4/6 correct (67%)");
    expect(md).toContain("## Mistakes");
    expect(md).toContain("- Question: Translate 'hello'");
    expect(md).toContain("  Your answer: ola");
    expect(md).toContain("  Correct: hola");
    // The fully-correct step is not listed as a mistake.
    expect(md).not.toContain("ok one");
    expect(md).toContain("## Weak areas");
    expect(md).toContain("- hola (2x)");
  });

  it("shows the (none) placeholder when no answer was recorded (#167 bug 1)", () => {
    const md = buildLessonResultMarkdown({
      lessonTitle: "L",
      dateStr: "d",
      correct: 0,
      total: 1,
      pct: 0,
      breakdown: [entry({ exerciseType: "matching", userAnswer: null })],
      weakAreas: [],
      labels: LABELS,
    });
    // The learner's answer line is ALWAYS present, falling back to the
    // localized "(none)" placeholder instead of being dropped.
    expect(md).toContain("  Your answer: (none)");
    expect(md).toContain("Correct: hola");
  });

  it("shows the no-mistakes line on a perfect run and omits empty weak areas", () => {
    const md = buildLessonResultMarkdown({
      lessonTitle: "L",
      dateStr: "d",
      correct: 3,
      total: 3,
      pct: 100,
      breakdown: [entry({ fullyCorrect: true, correct: 1 })],
      weakAreas: [],
      labels: LABELS,
    });
    expect(md).toContain("- No mistakes - perfect run!");
    expect(md).not.toContain("## Weak areas");
  });
});

describe("collectWeakAreas", () => {
  it("dedupes by element_key, drops mastered rows, sorts by count desc", () => {
    const areas = collectWeakAreas([
      elementError({
        element_key: "k1",
        correct_answer: "hola",
        error_count: 2,
      }),
      elementError({
        element_key: "k1",
        correct_answer: "hola",
        error_count: 5,
      }),
      elementError({
        element_key: "k2",
        correct_answer: "adios",
        error_count: 3,
      }),
      elementError({ element_key: "k3", correct_answer: "si", mastered: true }),
    ]);
    expect(areas).toEqual([
      { label: "hola", count: 5 },
      { label: "adios", count: 3 },
    ]);
  });

  it("skips rows with an empty correct_answer instead of using the element_key (#167 bug 2)", () => {
    // A per-token element_key (e.g. a single cloze blank) is NOT a
    // readable weak-area label; such rows are dropped entirely.
    const areas = collectWeakAreas([
      elementError({ element_key: "word-42", correct_answer: "" }),
    ]);
    expect(areas).toEqual([]);
  });

  it("drops rows with zero recorded errors (#167 bug 2)", () => {
    const areas = collectWeakAreas([
      elementError({
        element_key: "k1",
        correct_answer: "hola",
        error_count: 0,
      }),
      elementError({
        element_key: "k2",
        correct_answer: "adios",
        error_count: 2,
      }),
    ]);
    expect(areas).toEqual([{ label: "adios", count: 2 }]);
  });
});

describe("formatUserAnswer", () => {
  function exercise(
    over: Partial<ContentLessonExercise>,
  ): ContentLessonExercise {
    return {
      id: "ex1",
      type: "matching",
      prompt: "Match the pairs",
      card_ids: [],
      distractors: [],
      ...over,
    } as ContentLessonExercise;
  }

  it("renders a picture-choice answer as the chosen image label", () => {
    const ex = exercise({
      type: "picture_choice",
      images: [
        { src: "a.png", label: "apple" },
        { src: "b.png", label: "banana" },
      ],
    });
    expect(formatUserAnswer(ex, { kind: "picture_choice", selected: 1 })).toBe(
      "banana",
    );
  });

  it("renders a matching answer as 'left -> right' pairs", () => {
    const ex = exercise({
      type: "matching",
      pairs: [
        { left: "hello", right: "hola" },
        { left: "bye", right: "adios" },
      ],
    });
    // The learner paired left 0 with right 1 and left 1 with right 0.
    const text = formatUserAnswer(ex, {
      kind: "matching",
      matches: [
        [0, 1],
        [1, 0],
      ],
    });
    expect(text).toBe("hello -> adios, bye -> hola");
  });

  it("returns null when there is no raw answer", () => {
    expect(formatUserAnswer(exercise({}), null)).toBeNull();
    expect(formatUserAnswer(exercise({}), undefined)).toBeNull();
  });
});

describe("lessonResultFilename", () => {
  it("produces an ASCII, dated, slugified filename", () => {
    const name = lessonResultFilename(
      "Grüße & Höflichkeit",
      new Date("2026-06-09T10:00:00Z"),
    );
    expect(name).toBe("lesson-result-grusse-hoflichkeit-2026-06-09.md");
  });
});
