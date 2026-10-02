/** Tests for the set-completion review aggregation (#2792). */

import {describe, expect, it} from "vitest";

import {buildSetReview} from "./set-review";
import type {ElementError} from "../../storage/types/learning/element-errors";
import type {LessonProgress} from "../../storage/types";

function err(over: Partial<ElementError> = {}): ElementError {
  return {
    id: "e1",
    user_id: "u1",
    set_id: "s1",
    lesson_id: "01.json",
    exercise_id: "x1",
    element_key: "el",
    element_type: "free_text",
    user_answer: "falsch",
    correct_answer: "richtig",
    error_count: 1,
    correct_streak: 0,
    attempt_count: 1,
    hint_used_count: 0,
    mastered: false,
    mastered_at: null,
    last_error_at: "2026-06-10T12:00:00Z",
    last_attempt_at: "2026-06-10T12:00:00Z",
    ...over,
  } as ElementError;
}

function progress(over: Partial<LessonProgress> = {}): LessonProgress {
  return {
    id: "p1",
    user_id: "u1",
    source: "src",
    set_id: "s1",
    lesson_filename: "01.json",
    status: "completed",
    step_results: {},
    score_correct: 8,
    score_total: 10,
    time_spent_seconds: 120,
    started_at: "2026-06-10T11:00:00Z",
    updated_at: "2026-06-10T12:00:00Z",
    completed_at: "2026-06-10T12:00:00Z",
    paused_at: null,
    abandoned_at: null,
    ...over,
  } as LessonProgress;
}

describe("buildSetReview", () => {
  it("sums the headline figures across the whole set", () => {
    const review = buildSetReview({
      setId: "s1",
      errors: [err({error_count: 3}), err({id: "e2", error_count: 2, mastered: true})],
      progress: [progress(), progress({id: "p2", lesson_filename: "02.json", time_spent_seconds: 60})],
    });
    expect(review.totalErrors).toBe(5);
    expect(review.elementsTracked).toBe(2);
    expect(review.elementsMastered).toBe(1);
    expect(review.elementsOpen).toBe(1);
    expect(review.masteredShare).toBe(50);
    expect(review.timeSpentSeconds).toBe(180);
    expect(review.lessonsCompleted).toBe(2);
  });

  it("ignores rows from other sets (the set is the scope)", () => {
    const review = buildSetReview({
      setId: "s1",
      errors: [err({error_count: 3}), err({id: "e2", set_id: "other", error_count: 99})],
      progress: [progress(), progress({id: "p2", set_id: "other", time_spent_seconds: 9999})],
    });
    expect(review.totalErrors).toBe(3);
    expect(review.timeSpentSeconds).toBe(120);
  });

  it("groups mistakes per lesson, worst lesson first", () => {
    const review = buildSetReview({
      setId: "s1",
      errors: [
        err({lesson_id: "01.json", error_count: 1}),
        err({id: "e2", lesson_id: "02.json", error_count: 4}),
        err({id: "e3", lesson_id: "02.json", error_count: 2}),
      ],
      progress: [],
    });
    expect(review.byLesson.map((l) => [l.lessonId, l.errors])).toEqual([
      ["02.json", 6],
      ["01.json", 1],
    ]);
  });

  it("groups mistakes per exercise type, biggest first", () => {
    const review = buildSetReview({
      setId: "s1",
      errors: [
        err({element_type: "free_text", error_count: 2}),
        err({id: "e2", element_type: "matching", error_count: 5}),
      ],
      progress: [],
    });
    expect(review.byType[0]).toEqual({type: "matching", errors: 5, elements: 1});
  });

  it("ranks weak spots unmastered-first, then by error count", () => {
    const review = buildSetReview({
      setId: "s1",
      errors: [
        err({id: "a", element_key: "mastered-many", error_count: 9, mastered: true}),
        err({id: "b", element_key: "open-few", error_count: 1}),
      ],
      progress: [],
    });
    expect(review.weakAreas.map((w) => w.elementKey)).toEqual([
      "open-few",
      "mastered-many",
    ]);
  });

  it("reports an empty, non-crashing review when nothing was recorded", () => {
    const review = buildSetReview({setId: "s1", errors: [], progress: []});
    expect(review.totalErrors).toBe(0);
    expect(review.masteredShare).toBe(0);
    expect(review.byLesson).toEqual([]);
    expect(review.weakAreas).toEqual([]);
    expect(review.hasData).toBe(false);
  });

  it("counts an element with zero errors as tracked but not as a weak spot", () => {
    const review = buildSetReview({
      setId: "s1",
      errors: [err({error_count: 0, mastered: true})],
      progress: [],
    });
    expect(review.elementsTracked).toBe(1);
    expect(review.totalErrors).toBe(0);
    expect(review.weakAreas).toEqual([]);
    expect(review.hasData).toBe(true);
  });
});

describe("buildSetReview: mastered and open follow the errors, not the SRS flag alone (#3166)", () => {
  /**
   * Twelve played elements, three answered wrong once, nothing mastered yet -
   * the rows ``recordBulk`` leaves behind after a FIRST run (one row per
   * attempt, ``error_count`` 0 for a correct one). The old figures read this
   * as "0 % mastered, 12 open" although the learner scored 9 of 12.
   */
  function firstRun(): ElementError[] {
    return Array.from({length: 12}, (_, i) =>
      err({id: `e${i}`, element_key: `k${i}`, error_count: i < 3 ? 1 : 0}),
    );
  }

  it("counts an element as open only while it has an error and is not mastered", () => {
    const review = buildSetReview({setId: "s1", errors: firstRun(), progress: []});
    expect(review.elementsTracked).toBe(12);
    expect(review.totalErrors).toBe(3);
    expect(review.elementsOpen).toBe(3);
    expect(review.elementsMastered).toBe(9);
    expect(review.masteredShare).toBe(75);
  });

  it("closes an open element once the SRS marks it mastered", () => {
    const rows = firstRun();
    rows[0] = err({...rows[0], mastered: true, correct_streak: 3});
    const review = buildSetReview({setId: "s1", errors: rows, progress: []});
    expect(review.elementsOpen).toBe(2);
    expect(review.elementsMastered).toBe(10);
    expect(review.masteredShare).toBe(83);
  });

  it("reports zero open and a zero share when nothing was recorded", () => {
    const review = buildSetReview({setId: "s1", errors: [], progress: []});
    expect(review.elementsTracked).toBe(0);
    expect(review.elementsOpen).toBe(0);
    expect(review.elementsMastered).toBe(0);
    expect(review.masteredShare).toBe(0);
  });

  it.each([
    ["every element wrong, none mastered", {wrong: 12, masteredOfWrong: 0}, {open: 12, share: 0}],
    ["every element right", {wrong: 0, masteredOfWrong: 0}, {open: 0, share: 100}],
    ["every wrong element mastered since", {wrong: 3, masteredOfWrong: 3}, {open: 0, share: 100}],
  ])("partitions the tracked elements into open + mastered with %s", (_name, shape, expected) => {
    const rows = Array.from({length: 12}, (_, i) =>
      err({
        id: `e${i}`,
        element_key: `k${i}`,
        error_count: i < shape.wrong ? 2 : 0,
        mastered: i < shape.masteredOfWrong,
      }),
    );
    const review = buildSetReview({setId: "s1", errors: rows, progress: []});
    expect(review.elementsOpen).toBe(expected.open);
    expect(review.masteredShare).toBe(expected.share);
    expect(review.elementsOpen + review.elementsMastered).toBe(review.elementsTracked);
  });
});
