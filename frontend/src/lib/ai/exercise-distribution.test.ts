/**
 * AIX-04 (EXP-036) — tests for exercise distribution + balancing.
 */

import { describe, expect, it } from "vitest";

import { balanceExercises, distributionGaps } from "./exercise-distribution";
import type { ExerciseCard } from "./exercise-quality-gate";
import type { ExerciseType } from "./exercise-distribution";

function card(type: ExerciseType, n: number): ExerciseCard {
  switch (type) {
    case "matching":
      return {
        type,
        question: `m${n}`,
        pairs: [
          { left: "a", right: "1" },
          { left: "b", right: "2" },
          { left: "c", right: "3" },
        ],
      };
    case "cloze":
      return { type, question: `c${n} ___`, answer: `ans${n}`, distractors: [] };
    case "free_text":
      return { type, question: `f${n}`, accepts: [`ans${n}`], distractors: [] };
    case "word_tiles":
      return { type, question: `w${n}`, answer: `one two ${n}` };
    case "picture_choice":
      return {
        type,
        question: `p${n}`,
        options: [
          { label: `ans${n}`, is_correct: true },
          { label: "x", is_correct: false },
          { label: "y", is_correct: false },
        ],
      };
  }
}

function many(type: ExerciseType, count: number): ExerciseCard[] {
  return Array.from({ length: count }, (_, i) => card(type, i));
}

function noTripleRun(cards: ExerciseCard[]): boolean {
  for (let i = 0; i + 2 < cards.length; i++) {
    if (cards[i].type === cards[i + 1].type && cards[i].type === cards[i + 2].type) {
      return false;
    }
  }
  return true;
}

describe("balanceExercises", () => {
  it("returns empty for an empty list (no crash)", () => {
    expect(balanceExercises([])).toEqual([]);
  });

  it("keeps all cards (never deletes)", () => {
    const cards = [...many("matching", 10)];
    expect(balanceExercises(cards)).toHaveLength(10);
  });

  it("pushes surplus beyond maxPerType to the end", () => {
    const cards = [...many("matching", 6), ...many("cloze", 2)];
    const result = balanceExercises(cards, { maxPerType: 2 });
    expect(result).toHaveLength(8);
    // 2 matching + 2 cloze stay in the balanced front; the 4 surplus
    // matching are moved to the tail.
    expect(result.slice(-4).every((c) => c.type === "matching")).toBe(true);
    expect(result.slice(0, 4).filter((c) => c.type === "matching")).toHaveLength(2);
  });

  it("interleaves mixed types with no three-in-a-row", () => {
    const cards = [
      ...many("matching", 3),
      ...many("cloze", 3),
      ...many("free_text", 3),
    ];
    expect(noTripleRun(balanceExercises(cards))).toBe(true);
  });

  it("respects a custom maxPerType", () => {
    const cards = many("matching", 4);
    const result = balanceExercises(cards, { maxPerType: 1 });
    expect(result).toHaveLength(4);
  });
});

describe("distributionGaps", () => {
  it("reports missing target types below the variety minimum", () => {
    const gaps = distributionGaps(many("matching", 3));
    expect(gaps).toContain("cloze");
    expect(gaps).toContain("free_text");
    expect(gaps).not.toContain("matching");
  });

  it("returns nothing when the variety minimum is met", () => {
    const cards = [card("matching", 0), card("cloze", 0), card("free_text", 0)];
    expect(distributionGaps(cards)).toEqual([]);
  });
});
