/**
 * Tests for the session-scoped hint-usage tracker (#594 Hint Economy).
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  clearHintUsage,
  markHintUsed,
  stampHintUsage,
  wasHintUsed,
} from "./hint-usage";
import type { ElementAttempt } from "../../storage/types";

function attempt(exerciseId: string): ElementAttempt {
  return {
    set_id: "s",
    lesson_id: "l",
    exercise_id: exerciseId,
    element_key: "k",
    correct: true,
  };
}

beforeEach(() => {
  clearHintUsage();
});

describe("hint-usage tracker", () => {
  it("marks + reads usage by exercise id", () => {
    expect(wasHintUsed("ex1")).toBe(false);
    markHintUsed("ex1");
    expect(wasHintUsed("ex1")).toBe(true);
    expect(wasHintUsed("ex2")).toBe(false);
  });

  it("clear forgets all usage", () => {
    markHintUsed("ex1");
    clearHintUsage();
    expect(wasHintUsed("ex1")).toBe(false);
  });

  it("ignores an empty exercise id", () => {
    markHintUsed("");
    expect(wasHintUsed("")).toBe(false);
  });

  it("stampHintUsage flags only hinted exercises, without mutating input", () => {
    markHintUsed("ex1");
    const input = [attempt("ex1"), attempt("ex2")];
    const out = stampHintUsage(input);
    expect(out[0].hint_used).toBe(true);
    expect(out[1].hint_used ?? false).toBe(false);
    // Pure: the input is untouched.
    expect(input[0].hint_used).toBeUndefined();
  });

  it("preserves a pre-set hint_used flag", () => {
    const input = [{ ...attempt("ex3"), hint_used: true }];
    const out = stampHintUsage(input);
    expect(out[0].hint_used).toBe(true);
  });
});
