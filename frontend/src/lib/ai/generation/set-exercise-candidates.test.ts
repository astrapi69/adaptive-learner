/**
 * #1896 — tests for the pending-lesson probe behind the batch button.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  countLessonsWithoutExercises,
  exerciseCountOf,
} from "./set-exercise-candidates";
import type { ContentLesson, ContentSetEntry } from "../../../storage/types";

const listLessons = vi.fn();
const getLesson = vi.fn();

vi.mock("../../../storage", () => ({
  getStorage: () => ({ contentLoader: { listLessons, getLesson } }),
}));

const ENTRY = { id: "set1", source: "user-generated" } as ContentSetEntry;

function lesson(id: string, exercises: number): ContentLesson {
  const steps = [
    { id: "t1", type: "theory", title: "T", body: "theory" },
    ...Array.from({ length: exercises }, (_, i) => ({
      id: `e${i}`,
      type: "exercise",
      exercise: { id: `x${i}`, type: "free_text", prompt: "Q", card_ids: [] },
    })),
  ];
  return { id, title: id, steps } as unknown as ContentLesson;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("exerciseCountOf", () => {
  it("counts only exercise steps that carry an exercise", () => {
    expect(exerciseCountOf(lesson("a", 3))).toBe(3);
  });

  it("returns 0 for a theory-only lesson", () => {
    expect(exerciseCountOf(lesson("a", 0))).toBe(0);
  });
});

describe("countLessonsWithoutExercises", () => {
  it("counts the theory-only lessons of a set", async () => {
    listLessons.mockResolvedValue({ lessons: ["a.json", "b.json", "c.json"] });
    getLesson
      .mockResolvedValueOnce(lesson("a", 0))
      .mockResolvedValueOnce(lesson("b", 2))
      .mockResolvedValueOnce(lesson("c", 0));
    await expect(countLessonsWithoutExercises(ENTRY)).resolves.toBe(2);
  });

  it("returns 0 when every lesson already has exercises", async () => {
    listLessons.mockResolvedValue({ lessons: ["a.json"] });
    getLesson.mockResolvedValue(lesson("a", 5));
    await expect(countLessonsWithoutExercises(ENTRY)).resolves.toBe(0);
  });

  it("returns 0 for an empty set (boundary)", async () => {
    listLessons.mockResolvedValue({ lessons: [] });
    await expect(countLessonsWithoutExercises(ENTRY)).resolves.toBe(0);
    expect(getLesson).not.toHaveBeenCalled();
  });

  it("propagates a storage failure so the caller can fail open", async () => {
    listLessons.mockRejectedValue(new Error("storage unavailable"));
    await expect(countLessonsWithoutExercises(ENTRY)).rejects.toThrow(
      "storage unavailable",
    );
  });
});
