import { describe, it, expect } from "vitest";

import type {
  ContentLesson,
  ContentLessonExercise,
  ElementError,
  LessonProgress,
} from "../../storage/types";
import type { ExerciseBreakdownEntry } from "../lesson-summary";
import {
  buildLessonResultJson,
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

  it("honors a json extension (#167 bug 3)", () => {
    const name = lessonResultFilename(
      "Greetings",
      new Date("2026-06-09T10:00:00Z"),
      "json",
    );
    expect(name).toBe("lesson-result-greetings-2026-06-09.json");
  });
});

describe("buildLessonResultJson", () => {
  const LESSON: ContentLesson = {
    id: "01",
    title: "Greetings",
    description: "",
    estimated_minutes: 5,
    cards: [
      { id: "c1", front: "hello", back: "hola", tags: ["greeting", "a1"] },
      { id: "c2", front: "bye", back: "adios", tags: ["a1"] },
    ],
    steps: [
      { id: "intro", type: "theory", title: "Intro", body: "..." },
      {
        id: "ex-free",
        type: "exercise",
        title: "Say hello",
        exercise: {
          id: "ex-free",
          type: "free_text",
          prompt: "Translate 'hello'",
          card_ids: ["c1"],
          accept: ["hola"],
          distractors: [],
        },
      },
      {
        id: "ex-match",
        type: "exercise",
        title: "Match",
        exercise: {
          id: "ex-match",
          type: "matching",
          prompt: "Match the words",
          card_ids: ["c1", "c2"],
          pairs: [
            { left: "hello", right: "hola" },
            { left: "bye", right: "adios" },
          ],
          distractors: [],
        },
      },
    ],
  } as ContentLesson;

  const PROGRESS: LessonProgress = {
    step_results: {
      "ex-free": {
        correct: 1,
        total: 1,
        attempts: 1,
        completed_at: "2026-06-09",
        user_answer: "hola",
        raw_answer: { kind: "free_text", input: "hola " },
      },
      "ex-match": {
        correct: 0,
        total: 1,
        attempts: 1,
        completed_at: "2026-06-09",
        raw_answer: {
          kind: "matching",
          matches: [
            [0, 1],
            [1, 0],
          ],
        },
      },
    },
  } as unknown as LessonProgress;

  it("emits a structured entry per attempted exercise (#167 bugs 1, 3, 4)", () => {
    const json = buildLessonResultJson({
      lesson: LESSON,
      progress: PROGRESS,
      dateStr: "2026-06-09",
      correct: 1,
      total: 2,
      pct: 50,
      weakAreas: [{ label: "adios", count: 2 }],
    });
    expect(json.schema).toBe("adaptive-learner.lesson-result");
    expect(json.version).toBe(1);
    expect(json.lesson_title).toBe("Greetings");
    expect(json.date).toBe("2026-06-09");
    expect(json.score).toEqual({ correct: 1, total: 2, percent: 50 });
    // Theory step is skipped; both attempted exercises are present.
    expect(json.exercises).toHaveLength(2);

    const free = json.exercises[0];
    expect(free.question_id).toBe("ex-free");
    expect(free.prompt).toBe("Translate 'hello'");
    expect(free.user_answer).toBe("hola");
    // Verbatim raw input is preserved (#167 bug 4) — note the typo space.
    expect(free.raw_answer).toEqual({ kind: "free_text", input: "hola " });
    expect(free.correct_answer).toBe("hola");
    expect(free.is_correct).toBe(true);
    expect(free.concept_tags).toEqual(["greeting", "a1"]);

    const match = json.exercises[1];
    // Matching reconstructs a readable user_answer from raw_answer.
    expect(match.user_answer).toBe("hello -> adios, bye -> hola");
    expect(match.is_correct).toBe(false);
    // Deduplicated union of both cards' tags.
    expect(match.concept_tags).toEqual(["greeting", "a1"]);

    expect(json.weak_areas).toEqual([{ label: "adios", count: 2 }]);
  });

  it("skips exercises that were never attempted", () => {
    const json = buildLessonResultJson({
      lesson: LESSON,
      progress: { step_results: {} } as unknown as LessonProgress,
      dateStr: "2026-06-09",
      correct: 0,
      total: 0,
      pct: 0,
      weakAreas: [],
    });
    expect(json.exercises).toEqual([]);
  });
});
