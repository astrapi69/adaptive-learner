/**
 * AIX-03 (EXP-036) — tests for the content quality gate.
 */

import { describe, expect, it } from "vitest";

import { validateExerciseQuality } from "./exercise-quality-gate";
import type { ExerciseCard } from "./exercise-quality-gate";
import type { ExtensionCard } from "./extension-cards";

function matching(question: string, n = 3): ExerciseCard {
  return {
    type: "matching",
    question,
    pairs: Array.from({ length: n }, (_, i) => ({ left: `l${i}`, right: `right${i}` })),
  };
}

function freeText(question: string, accepts: string[], distractors: string[] = []): ExerciseCard {
  return { type: "free_text", question, accepts, distractors };
}

function cloze(question: string, answer: string, distractors: string[] = []): ExerciseCard {
  return { type: "cloze", question, answer, distractors };
}

describe("validateExerciseQuality", () => {
  it("returns empty for an empty list (no crash)", () => {
    expect(validateExerciseQuality([])).toEqual({ passed: [], rejected: [], warnings: [] });
  });

  it("passes good, varied exercises", () => {
    const cards = [
      matching("Match the modules."),
      cloze("hosts: ___ targets all.", "all", ["one", "two"]),
      freeText("What is idempotence?", ["no change on re-run"], ["faster"]),
    ];
    const { passed, rejected } = validateExerciseQuality(cards);
    expect(passed).toHaveLength(3);
    expect(rejected).toHaveLength(0);
  });

  it("rejects a duplicate question", () => {
    const cards = [
      freeText("Same question?", ["alpha"]),
      freeText("Same question?", ["beta"]),
    ];
    const { passed, rejected } = validateExerciseQuality(cards);
    expect(passed).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it("rejects a duplicate answer set", () => {
    const cards = [cloze("A ___ here", "answer"), cloze("B ___ there", "answer")];
    const { passed, rejected } = validateExerciseQuality(cards);
    expect(passed).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it("rejects a trivial answer (echoes a word in the question)", () => {
    const cards = [freeText("Translate the word cat", ["cat"])];
    const { passed, rejected } = validateExerciseQuality(cards);
    expect(passed).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });

  it("rejects a too-short answer", () => {
    const cards = [cloze("value: ___", "a")];
    const { rejected } = validateExerciseQuality(cards);
    expect(rejected).toHaveLength(1);
  });

  it("rejects a distractor equal to the answer", () => {
    const cards = [cloze("state: ___", "stopped", ["stopped", "running"])];
    const { passed, rejected } = validateExerciseQuality(cards);
    expect(passed).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });

  it("rejects a matching card with fewer than three pairs", () => {
    const cards = [matching("Too few.", 2)];
    const { rejected } = validateExerciseQuality(cards);
    expect(rejected).toHaveLength(1);
  });

  it("warns when every exercise is the same type", () => {
    const cards = [
      cloze("a ___ x", "alpha", ["d1", "d2"]),
      cloze("b ___ y", "beta", ["d1", "d2"]),
    ];
    const { warnings } = validateExerciseQuality(cards);
    expect(warnings.some((w) => w.code === "single_type")).toBe(true);
  });

  it("warns on a cloze with fewer than two distractors", () => {
    const cards = [cloze("a ___ x", "alpha", ["only"])];
    const { warnings } = validateExerciseQuality(cards);
    expect(warnings.some((w) => w.code === "cloze_few_distractors")).toBe(true);
  });

  it("warns when all distractors are identical", () => {
    const cards = [freeText("Q here?", ["right"], ["same", "same"])];
    const { warnings } = validateExerciseQuality(cards);
    expect(warnings.some((w) => w.code === "all_distractors_identical")).toBe(true);
  });

  it("warns when question and answer use different scripts", () => {
    const cards = [freeText("Was bedeutet das Wort?", ["ありがとう"])];
    const { warnings } = validateExerciseQuality(cards);
    expect(warnings.some((w) => w.code === "language_mismatch")).toBe(true);
  });
});

describe("validateExerciseQuality — text extensions (#2355)", () => {
  const readingCard = (passage: string, questions: unknown[]): ExtensionCard => ({
    type: "ext:al-reading-comprehension",
    question: "Read and answer.",
    ext_payload: { passage, questions },
  });

  it("passes a valid extension card (payload validated via its shipped validator)", () => {
    const card = readingCard("A passage long enough to read and reason about.", [
      { prompt: "Q?", type: "free_text", accept: ["an answer"] },
    ]);
    const { passed, rejected } = validateExerciseQuality([card]);
    expect(passed).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it("rejects an extension card whose payload fails its validator (empty passage)", () => {
    const card = readingCard("", [{ prompt: "Q?", type: "free_text", accept: ["a"] }]);
    const { passed, rejected } = validateExerciseQuality([card]);
    expect(passed).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });

  it("dedupes extension cards by prompt", () => {
    const a = readingCard("Passage one is long enough.", [
      { prompt: "Q?", type: "free_text", accept: ["x"] },
    ]);
    const b = { ...a };
    const { passed } = validateExerciseQuality([a, b]);
    expect(passed).toHaveLength(1);
  });
});
