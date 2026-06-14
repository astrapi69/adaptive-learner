/**
 * lesson-splitter part-title formatter (#512).
 *
 * The splitter's default title output is parity-pinned with the Python
 * mirror ("{title} — Part N of M"); the optional ``partTitle`` formatter
 * lets the frontend localize the per-part title ("… - Teil N") WITHOUT
 * changing the parity default. These tests pin both halves.
 */

import { describe, expect, it } from "vitest";

import { defaultPartTitle, splitLesson } from "./lesson-splitter";
import type { ContentLesson } from "../../storage/types";

function makeLesson(stepCount: number): ContentLesson {
  const cards = Array.from({ length: stepCount }, (_, i) => ({
    id: `c${i}`,
    front: `f${i}`,
    back: `b${i}`,
    tags: [] as string[],
  }));
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    id: `s${i}`,
    type: "exercise" as const,
    exercise: {
      id: `e${i}`,
      type: "free_text" as const,
      prompt: `p${i}`,
      card_ids: [`c${i}`],
      accept: ["x"],
      distractors: [] as string[],
    },
  }));
  return {
    id: "lesson-x",
    title: "My Lesson",
    description: "",
    estimated_minutes: stepCount,
    cards,
    steps,
  } as unknown as ContentLesson;
}

describe("splitLesson partTitle option (#512)", () => {
  it("uses the parity-pinned English default when no formatter is given", () => {
    const parts = splitLesson(makeLesson(8), { maxStepsPerPart: 3 });
    expect(parts.map((p) => p.title)).toEqual([
      "My Lesson — Part 1 of 3",
      "My Lesson — Part 2 of 3",
      "My Lesson — Part 3 of 3",
    ]);
    expect(parts[0].title).toBe(defaultPartTitle("My Lesson", 1, 3));
  });

  it("applies a localized partTitle formatter to every part", () => {
    const partTitle = (base: string, n: number, m: number) =>
      `${base} - Teil ${n} von ${m}`;
    const parts = splitLesson(makeLesson(8), { maxStepsPerPart: 3, partTitle });
    expect(parts.map((p) => p.title)).toEqual([
      "My Lesson - Teil 1 von 3",
      "My Lesson - Teil 2 von 3",
      "My Lesson - Teil 3 von 3",
    ]);
    // The formatter only changes titles — ids + step chunking are intact.
    expect(parts.map((p) => p.id)).toEqual([
      "lesson-x-part-1",
      "lesson-x-part-2",
      "lesson-x-part-3",
    ]);
  });

  it("never calls the formatter when no split is needed", () => {
    let called = false;
    const parts = splitLesson(makeLesson(5), {
      maxStepsPerPart: 10,
      partTitle: () => {
        called = true;
        return "X";
      },
    });
    expect(parts).toHaveLength(1);
    expect(parts[0].title).toBe("My Lesson");
    expect(called).toBe(false);
  });
});
