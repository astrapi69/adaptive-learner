/** Tests for the set page's lesson list model (#2793 stages 2-3). */

import {describe, expect, it} from "vitest";

import {buildSetLessonList} from "./set-lesson-list";
import type {LessonProgress} from "../../../storage/types";

function prog(over: Partial<LessonProgress> = {}): LessonProgress {
  return {
    id: "p", user_id: "u", source: "src", set_id: "s1",
    lesson_filename: "01.json", status: "completed",
    step_results: {}, score_correct: 3, score_total: 3,
    time_spent_seconds: 60, started_at: "", updated_at: "",
    completed_at: "2026-06-10T12:00:00Z", paused_at: null, abandoned_at: null,
    ...over,
  } as LessonProgress;
}

const FILES = ["01.json", "02.json", "03.json"];

describe("buildSetLessonList", () => {
  it("lists every lesson in set order with its 1-based number", () => {
    const list = buildSetLessonList({setId: "s1", lessons: FILES, progress: []});
    expect(list.lessons.map((l) => [l.index, l.filename])).toEqual([
      [1, "01.json"],
      [2, "02.json"],
      [3, "03.json"],
    ]);
  });

  it("marks completed lessons and counts them", () => {
    const list = buildSetLessonList({
      setId: "s1", lessons: FILES,
      progress: [prog(), prog({id: "p2", lesson_filename: "02.json"})],
    });
    expect(list.lessons.map((l) => l.status)).toEqual([
      "completed", "completed", "not_started",
    ]);
    expect(list.completed).toBe(2);
    expect(list.total).toBe(3);
    expect(list.percent).toBe(67);
  });

  it("carries the score of a completed lesson", () => {
    const list = buildSetLessonList({
      setId: "s1", lessons: FILES,
      progress: [prog({score_correct: 4, score_total: 5})],
    });
    expect(list.lessons[0].scoreCorrect).toBe(4);
    expect(list.lessons[0].scoreTotal).toBe(5);
  });

  it("points 'continue here' at the first unfinished lesson", () => {
    const list = buildSetLessonList({
      setId: "s1", lessons: FILES,
      progress: [prog(), prog({id: "p2", lesson_filename: "02.json", status: "in_progress", completed_at: null})],
    });
    expect(list.currentFilename).toBe("02.json");
    expect(list.lessons[1].status).toBe("in_progress");
    expect(list.lessons[1].isCurrent).toBe(true);
  });

  it("points at the first lesson when nothing was started", () => {
    const list = buildSetLessonList({setId: "s1", lessons: FILES, progress: []});
    expect(list.currentFilename).toBe("01.json");
    expect(list.percent).toBe(0);
  });

  it("has no current lesson once the whole set is done", () => {
    const list = buildSetLessonList({
      setId: "s1", lessons: FILES,
      progress: FILES.map((f, i) => prog({id: `p${i}`, lesson_filename: f})),
    });
    expect(list.currentFilename).toBeNull();
    expect(list.percent).toBe(100);
  });

  it("ignores progress rows of other sets", () => {
    const list = buildSetLessonList({
      setId: "s1", lessons: FILES,
      progress: [prog({set_id: "other", lesson_filename: "01.json"})],
    });
    expect(list.completed).toBe(0);
  });

  it("returns an empty, non-crashing model for a set with no lessons", () => {
    const list = buildSetLessonList({setId: "s1", lessons: [], progress: []});
    expect(list.lessons).toEqual([]);
    expect(list.total).toBe(0);
    expect(list.percent).toBe(0);
    expect(list.currentFilename).toBeNull();
  });

  // #2835 — the list previously carried only the filename, which the
  // page rendered verbatim (e.g. "100-wiederholung-....json") instead
  // of the lesson's actual title.
  it("carries each lesson's title from the titles map", () => {
    const list = buildSetLessonList({
      setId: "s1", lessons: FILES, progress: [],
      titles: new Map([
        ["01.json", "Greetings"],
        ["02.json", "Numbers"],
      ]),
    });
    expect(list.lessons.map((l) => l.title)).toEqual([
      "Greetings", "Numbers", "03.json",
    ]);
  });

  it("falls back to the filename when no titles map is given", () => {
    const list = buildSetLessonList({setId: "s1", lessons: FILES, progress: []});
    expect(list.lessons.map((l) => l.title)).toEqual(FILES);
  });
});
