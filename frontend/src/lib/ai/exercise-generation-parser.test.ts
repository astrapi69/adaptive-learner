import { describe, expect, it } from "vitest";

import {
  extractCardsArray,
  parseGeneratedExercises,
  type ValidCard,
} from "./exercise-generation-parser";

/** A reply with one valid card of every type. */
const ALL_TYPES = JSON.stringify({
  cards: [
    {
      type: "matching",
      question: "Match the module to its job.",
      pairs: [
        { left: "file", right: "manage files" },
        { left: "copy", right: "copy files" },
        { left: "service", right: "manage services" },
      ],
    },
    {
      type: "cloze",
      question: "hosts: ___ targets all hosts.",
      answer: "all",
      distractors: ["localhost", "webservers"],
    },
    {
      type: "free_text",
      question: "What does idempotence mean?",
      accepts: ["running again changes nothing", "same result every run"],
      distractors: ["it speeds up"],
    },
    {
      type: "word_tiles",
      question: "Reassemble the sentence.",
      answer: "tasks run in order",
    },
    {
      type: "picture_choice",
      question: "Pick the correct state value.",
      options: [
        { label: "stopped", is_correct: true },
        { label: "stoped", is_correct: false },
        { label: "halt", is_correct: false },
      ],
    },
  ],
});

describe("parseGeneratedExercises — happy path", () => {
  it("parses valid JSON into one card of each type", () => {
    const result = parseGeneratedExercises(ALL_TYPES);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.cards.map((c) => c.type)).toEqual([
      "matching",
      "cloze",
      "free_text",
      "word_tiles",
      "picture_choice",
    ]);
  });

  it("extracts JSON from Markdown code fences", () => {
    const fenced = "Here you go:\n```json\n" + ALL_TYPES + "\n```\nHope it helps!";
    const result = parseGeneratedExercises(fenced);
    expect(result.cards).toHaveLength(5);
  });

  it("accepts a bare top-level array", () => {
    const bare = JSON.stringify([
      { type: "cloze", question: "a ___ b", answer: "x", distractors: [] },
    ]);
    const result = parseGeneratedExercises(bare);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].type).toBe("cloze");
  });
});

describe("parseGeneratedExercises — graceful degradation", () => {
  it("returns 0 cards + an error on broken JSON, never throws", () => {
    const result = parseGeneratedExercises("totally not json {{{ broken");
    expect(result.cards).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns an error on an empty response", () => {
    const result = parseGeneratedExercises("   ");
    expect(result.cards).toEqual([]);
    expect(result.errors).toContain("empty AI response");
  });

  it("handles a valid JSON object with no cards array", () => {
    const result = parseGeneratedExercises(JSON.stringify({ note: "no cards here" }));
    expect(result.cards).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("parseGeneratedExercises — per-type validation", () => {
  function single(card: unknown): ReturnType<typeof parseGeneratedExercises> {
    return parseGeneratedExercises(JSON.stringify({ cards: [card] }));
  }

  it("skips an unknown exercise type", () => {
    const result = single({ type: "multiple_choice", question: "?", options: [] });
    expect(result.cards).toEqual([]);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toMatch(/unknown exercise type: multiple_choice/);
  });

  it("skips a card with no question", () => {
    const result = single({ type: "cloze", answer: "x", distractors: [] });
    expect(result.cards).toEqual([]);
    expect(result.errors[0]).toMatch(/missing question/);
  });

  it("skips matching with fewer than 3 complete pairs", () => {
    const result = single({
      type: "matching",
      question: "Match.",
      pairs: [{ left: "a", right: "b" }, { left: "c" }],
    });
    expect(result.cards).toEqual([]);
    expect(result.errors[0]).toMatch(/needs >= 3 complete pairs/);
  });

  it("skips a cloze whose question has no ___ blank", () => {
    const result = single({ type: "cloze", question: "no blank", answer: "x", distractors: [] });
    expect(result.errors[0]).toMatch(/no ___ blank/);
  });

  it("skips a cloze missing its answer", () => {
    const result = single({ type: "cloze", question: "a ___ b", distractors: ["y"] });
    expect(result.errors[0]).toMatch(/missing answer/);
  });

  it("skips free_text with no accepted answers", () => {
    const result = single({ type: "free_text", question: "Explain.", accepts: [] });
    expect(result.errors[0]).toMatch(/>= 1 accepted answer/);
  });

  it("skips word_tiles with a single-token answer", () => {
    const result = single({ type: "word_tiles", question: "Build.", answer: "word" });
    expect(result.errors[0]).toMatch(/at least two tokens/);
  });

  it("skips picture_choice with fewer than 3 options", () => {
    const result = single({
      type: "picture_choice",
      question: "Pick.",
      options: [{ label: "a", is_correct: true }, { label: "b" }],
    });
    expect(result.errors[0]).toMatch(/needs >= 3 options/);
  });

  it("skips picture_choice with no correct option", () => {
    const result = single({
      type: "picture_choice",
      question: "Pick.",
      options: [{ label: "a" }, { label: "b" }, { label: "c" }],
    });
    expect(result.errors[0]).toMatch(/no option marked correct/);
  });
});

describe("parseGeneratedExercises — mixed quality + duplicates", () => {
  it("keeps good cards and skips bad ones, counting both", () => {
    const reply = JSON.stringify({
      cards: [
        { type: "cloze", question: "a ___ b", answer: "x", distractors: ["y"] }, // good
        { type: "free_text", question: "?", accepts: [] }, // bad: no accepts
        { type: "frobnicate", question: "?" }, // bad: unknown type
        {
          type: "matching",
          question: "Match.",
          pairs: [
            { left: "a", right: "1" },
            { left: "b", right: "2" },
            { left: "c", right: "3" },
          ],
        }, // good
      ],
    });
    const result = parseGeneratedExercises(reply);
    expect(result.cards.map((c) => c.type)).toEqual(["cloze", "matching"]);
    expect(result.skipped).toBe(2);
    expect(result.errors).toHaveLength(2);
  });

  it("drops duplicate cards (identical type + content)", () => {
    const card = { type: "cloze", question: "a ___ b", answer: "x", distractors: ["y"] };
    const result = parseGeneratedExercises(JSON.stringify({ cards: [card, { ...card }] }));
    expect(result.cards).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toMatch(/duplicate cloze card/);
  });

  it("drops empty string fields (treated as missing)", () => {
    const result = parseGeneratedExercises(
      JSON.stringify({ cards: [{ type: "cloze", question: "  ", answer: "x", distractors: [] }] }),
    );
    expect(result.cards).toEqual([]);
    expect(result.errors[0]).toMatch(/missing question/);
  });
});

describe("extractCardsArray", () => {
  it("reads cards from an object, a bare array, and prose-wrapped JSON", () => {
    expect(extractCardsArray(JSON.stringify({ cards: [1, 2] }))).toEqual([1, 2]);
    expect(extractCardsArray(JSON.stringify([3, 4]))).toEqual([3, 4]);
    expect(extractCardsArray('blah {"cards": [5]} tail')).toEqual([5]);
  });

  it("returns null when there is no array", () => {
    expect(extractCardsArray("no json at all")).toBeNull();
  });
});

// Type-level guard: a parsed cloze card exposes its answer.
describe("ValidCard typing", () => {
  it("narrows by discriminant", () => {
    const { cards } = parseGeneratedExercises(ALL_TYPES);
    const cloze = cards.find((c: ValidCard) => c.type === "cloze");
    expect(cloze && cloze.type === "cloze" && cloze.answer).toBe("all");
  });
});
