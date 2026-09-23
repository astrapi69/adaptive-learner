import {describe, expect, it} from "vitest";

import type {ElementError} from "../../storage/types/learning/element-errors";
import type {LessonProgress} from "../../storage/types";
import {buildLessonReview} from "./lesson-review";

function error(overrides: Partial<ElementError>): ElementError {
  return {
    id: "e",
    user_id: "u1",
    set_id: "s1",
    lesson_id: "01.json",
    exercise_id: "x",
    element_key: "el",
    element_type: "vocabulary",
    user_answer: "wrong",
    correct_answer: "right",
    error_count: 1,
    correct_streak: 0,
    attempt_count: 1,
    hint_used_count: 0,
    mastered: false,
    mastered_at: null,
    last_error_at: "2026-09-16T00:00:00Z",
    last_attempt_at: "2026-09-16T00:00:00Z",
    ...overrides,
  } as ElementError;
}

function progress(overrides: Partial<LessonProgress>): LessonProgress {
  return {
    id: "p",
    user_id: "u1",
    source: "bundled:x",
    set_id: "s1",
    lesson_filename: "01.json",
    status: "completed",
    time_spent_seconds: 120,
    ...overrides,
  } as unknown as LessonProgress;
}

describe("buildLessonReview (#3124)", () => {
  it("counts only the rows of the given lesson and set", () => {
    const review = buildLessonReview({
      setId: "s1",
      lessonId: "01.json",
      errors: [
        error({id: "a", element_key: "a", error_count: 2}),
        error({id: "b", element_key: "b", lesson_id: "02.json", error_count: 5}),
        error({id: "c", element_key: "c", set_id: "s2", error_count: 7}),
      ],
      progress: [
        progress({id: "p1", time_spent_seconds: 90}),
        progress({id: "p2", lesson_filename: "02.json", time_spent_seconds: 600}),
      ],
    });
    expect(review.totalErrors).toBe(2);
    expect(review.elementsTracked).toBe(1);
    expect(review.timeSpentSeconds).toBe(90);
    expect(review.lessonsCompleted).toBe(1);
    expect(review.byLesson).toEqual([{lessonId: "01.json", errors: 2, elements: 1}]);
  });

  it("reports the same figures the set review computes for that lesson alone", () => {
    const rows = [
      error({id: "a", element_key: "a", error_count: 3, element_type: "vocabulary"}),
      error({id: "b", element_key: "b", error_count: 1, element_type: "grammar_rule", mastered: true}),
    ];
    const review = buildLessonReview({setId: "s1", lessonId: "01.json", errors: rows, progress: []});
    expect(review.hasData).toBe(true);
    expect(review.masteredShare).toBe(50);
    expect(review.byType.map((entry) => [entry.type, entry.errors])).toEqual([
      ["vocabulary", 3],
      ["grammar_rule", 1],
    ]);
    expect(review.weakAreas[0]).toMatchObject({elementKey: "a", errorCount: 3, lastAnswer: "wrong"});
  });

  it.each([
    ["no rows at all", [], []],
    ["only other lessons", [error({lesson_id: "02.json"})], [progress({lesson_filename: "02.json"})]],
  ])("has no data with %s", (_name, errors, rows) => {
    const review = buildLessonReview({setId: "s1", lessonId: "01.json", errors, progress: rows});
    expect(review.hasData).toBe(false);
    expect(review.totalErrors).toBe(0);
  });

  it("derives open and mastered from this lesson's errors, not the SRS flag alone (#3166)", () => {
    const errors = Array.from({length: 12}, (_, i) =>
      error({id: `e${i}`, element_key: `k${i}`, error_count: i < 3 ? 1 : 0}),
    ).concat(error({id: "x", element_key: "x", lesson_id: "02.json", error_count: 1}));
    const review = buildLessonReview({setId: "s1", lessonId: "01.json", errors, progress: []});
    expect(review.elementsTracked).toBe(12);
    expect(review.totalErrors).toBe(3);
    expect(review.elementsOpen).toBe(3);
    expect(review.masteredShare).toBe(75);
  });

  it("honours the weak-area cap", () => {
    const errors = Array.from({length: 4}, (_, i) =>
      error({id: `e${i}`, element_key: `k${i}`, error_count: i + 1}),
    );
    const review = buildLessonReview({setId: "s1", lessonId: "01.json", errors, progress: [], weakAreaLimit: 2});
    expect(review.weakAreas.map((area) => area.elementKey)).toEqual(["k3", "k2"]);
  });
});
