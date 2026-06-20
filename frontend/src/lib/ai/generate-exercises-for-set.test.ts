/**
 * AIX-06 (EXP-036) — tests for batch set generation.
 */

import { describe, expect, it, vi } from "vitest";

import {
  estimateBatchTokens,
  generateExercisesForSet,
  type BatchLesson,
  type SetBatchDeps,
} from "./generate-exercises-for-set";
import type { ContentLessonExercise } from "../../storage/types";

function lesson(id: string, exerciseCount: number): BatchLesson {
  return {
    id,
    filename: `${id}.json`,
    title: id,
    theorySteps: [{ id: "t", title: "T", body: "theory" }],
    exerciseCount,
  };
}

function fakeExercise(id: string): ContentLessonExercise {
  return { id, type: "free_text", prompt: "Q", card_ids: [], accept: ["a"], distractors: [] };
}

function deps(
  lessons: BatchLesson[],
  generate: SetBatchDeps["generateForLesson"],
): { deps: SetBatchDeps; saved: string[] } {
  const saved: string[] = [];
  return {
    saved,
    deps: {
      loadLessons: async () => lessons,
      generateForLesson: generate,
      saveLessonExercises: async (l) => {
        saved.push(l.id);
      },
    },
  };
}

describe("estimateBatchTokens", () => {
  it("scales with lesson count", () => {
    expect(estimateBatchTokens(0)).toBe(0);
    expect(estimateBatchTokens(3)).toBe(9000);
  });
});

describe("generateExercisesForSet", () => {
  it("generates for every theory-only lesson", async () => {
    const { deps: d, saved } = deps(
      [lesson("a", 0), lesson("b", 0), lesson("c", 0)],
      async (l) => [fakeExercise(`${l.id}-1`), fakeExercise(`${l.id}-2`)],
    );
    const result = await generateExercisesForSet("set1", { deps: d });
    expect(result.total).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.generated).toBe(6);
    expect(saved.sort()).toEqual(["a", "b", "c"]);
  });

  it("skips lessons that already have exercises", async () => {
    const { deps: d, saved } = deps(
      [lesson("a", 0), lesson("b", 5)],
      async (l) => [fakeExercise(`${l.id}-1`)],
    );
    const result = await generateExercisesForSet("set1", { deps: d });
    expect(result.total).toBe(1);
    expect(saved).toEqual(["a"]);
  });

  it("continues past a lesson that errors", async () => {
    const { deps: d, saved } = deps(
      [lesson("a", 0), lesson("b", 0), lesson("c", 0)],
      async (l) => {
        if (l.id === "b") throw new Error("boom");
        return [fakeExercise(`${l.id}-1`)];
      },
    );
    const result = await generateExercisesForSet("set1", { deps: d });
    expect(result.succeeded).toBe(2);
    expect(result.skipped).toBe(1);
    expect(saved.sort()).toEqual(["a", "c"]);
  });

  it("counts a lesson with no usable exercises as skipped", async () => {
    const { deps: d, saved } = deps([lesson("a", 0)], async () => []);
    const result = await generateExercisesForSet("set1", { deps: d });
    expect(result.succeeded).toBe(0);
    expect(result.skipped).toBe(1);
    expect(saved).toEqual([]);
  });

  it("stops when the signal is already aborted (keeps prior work)", async () => {
    const controller = new AbortController();
    let processed = 0;
    const { deps: d } = deps([lesson("a", 0), lesson("b", 0)], async (l) => {
      processed++;
      if (l.id === "a") controller.abort();
      return [fakeExercise(`${l.id}-1`)];
    });
    const result = await generateExercisesForSet("set1", {
      deps: d,
      signal: controller.signal,
    });
    // "a" runs, aborts the controller; "b" is not processed.
    expect(processed).toBe(1);
    expect(result.cancelled).toBe(true);
    expect(result.succeeded).toBe(1);
  });

  it("reports progress for each candidate", async () => {
    const onProgress = vi.fn();
    const { deps: d } = deps([lesson("a", 0), lesson("b", 0)], async (l) => [
      fakeExercise(`${l.id}-1`),
    ]);
    await generateExercisesForSet("set1", { deps: d, onProgress });
    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });
});
