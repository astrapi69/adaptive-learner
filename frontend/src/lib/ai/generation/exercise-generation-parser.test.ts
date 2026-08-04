import { describe, expect, it } from "vitest";

import {
  extractCardsArray,
  parseGeneratedExercises,
} from "./exercise-generation-parser";
import { ALLOWED_EXERCISE_TYPES } from "./exercise-generation-prompt";

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
    {
      type: "multiple_choice",
      question: "Which state values are valid for the service module?",
      options: [
        { text: "started", is_correct: true },
        { text: "stopped", is_correct: true },
        { text: "rebooted", is_correct: false },
      ],
      multiple: true,
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
      "multiple_choice",
    ]);
  });

  it("extracts JSON from Markdown code fences", () => {
    const fenced = "Here you go:\n```json\n" + ALL_TYPES + "\n```\nHope it helps!";
    const result = parseGeneratedExercises(fenced);
    expect(result.cards).toHaveLength(6);
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

describe("parseGeneratedExercises — multiple_choice (#2353)", () => {
  const mc = (options: unknown[], multiple?: boolean) =>
    JSON.stringify({
      cards: [
        {
          type: "multiple_choice",
          question: "Which of these are Ansible modules?",
          options,
          ...(multiple === undefined ? {} : { multiple }),
        },
      ],
    });

  it("parses a single-choice MC card (exactly one correct, multiple omitted)", () => {
    const result = parseGeneratedExercises(
      mc([
        { text: "apt", is_correct: true },
        { text: "banana", is_correct: false },
      ]),
    );
    expect(result.cards).toHaveLength(1);
    const card = result.cards[0];
    expect(card.type).toBe("multiple_choice");
    if (card.type === "multiple_choice") {
      expect(card.multiple).toBe(false);
      expect(card.options).toHaveLength(2);
    }
  });

  it("infers multiple:true when more than one option is correct and no flag is given", () => {
    const result = parseGeneratedExercises(
      mc([
        { text: "apt", is_correct: true },
        { text: "copy", is_correct: true },
        { text: "banana", is_correct: false },
      ]),
    );
    const card = result.cards[0];
    if (card?.type === "multiple_choice") expect(card.multiple).toBe(true);
    else throw new Error("expected a multiple_choice card");
  });

  it("drops an MC card with fewer than two options", () => {
    const result = parseGeneratedExercises(mc([{ text: "apt", is_correct: true }]));
    expect(result.cards).toHaveLength(0);
    expect(result.errors.join(" ")).toMatch(/at least 2 options|>= 2 options/i);
  });

  it("drops an MC card with no correct option", () => {
    const result = parseGeneratedExercises(
      mc([
        { text: "apt", is_correct: false },
        { text: "banana", is_correct: false },
      ]),
    );
    expect(result.cards).toHaveLength(0);
    expect(result.errors.join(" ")).toMatch(/correct/i);
  });

  it("drops a single-choice MC card that marks two options correct (contradiction)", () => {
    const result = parseGeneratedExercises(
      mc(
        [
          { text: "apt", is_correct: true },
          { text: "copy", is_correct: true },
        ],
        false,
      ),
    );
    expect(result.cards).toHaveLength(0);
    expect(result.errors.join(" ")).toMatch(/exactly one|single/i);
  });

  it("drops an MC card with duplicate option texts (E-MC-DUP-OPTION)", () => {
    const result = parseGeneratedExercises(
      mc([
        { text: "apt", is_correct: true },
        { text: "apt", is_correct: false },
        { text: "copy", is_correct: false },
      ]),
    );
    expect(result.cards).toHaveLength(0);
    expect(result.errors.join(" ")).toMatch(/unique|duplicate/i);
  });
});

describe("parseGeneratedExercises — text extensions (#2355)", () => {
  it("parses an ext:al-categorization card into an ExtensionCard with ext_payload", () => {
    const raw = JSON.stringify({
      cards: [
        {
          type: "ext:al-categorization",
          question: "Sort the terms.",
          categories: [
            { name: "Modules", items: ["copy", "service"] },
            { name: "Concepts", items: ["idempotence"] },
          ],
        },
      ],
    });
    const result = parseGeneratedExercises(raw);
    expect(result.cards).toHaveLength(1);
    const card = result.cards[0];
    expect(card.type).toBe("ext:al-categorization");
    expect("ext_payload" in card && card.ext_payload).toBeTruthy();
  });

  it("parses ext:al-error-correction, keeping tokens/error_index/accept", () => {
    const raw = JSON.stringify({
      cards: [
        {
          type: "ext:al-error-correction",
          question: "Fix the wrong word.",
          tokens: ["Ansible", "needs", "an", "agent"],
          error_index: 2,
          accept: ["no"],
        },
      ],
    });
    const card = parseGeneratedExercises(raw).cards[0];
    expect(card.type).toBe("ext:al-error-correction");
    const payload = "ext_payload" in card ? card.ext_payload : {};
    expect((payload as { tokens: string[] }).tokens).toHaveLength(4);
    expect((payload as { error_index: number }).error_index).toBe(2);
  });

  it("does NOT parse the media extensions (out of scope)", () => {
    const raw = JSON.stringify({
      cards: [{ type: "ext:al-dictation", question: "?", audio: "", accept: [] }],
    });
    const result = parseGeneratedExercises(raw);
    expect(result.cards).toHaveLength(0);
    expect(result.errors.join(" ")).toMatch(/unknown exercise type: ext:al-dictation/);
  });
});

describe("parseGeneratedExercises — branch coverage guard (#2353)", () => {
  /** A minimal valid card for each allowed type, so the guard proves the
   *  parser has a working branch for every entry in ALLOWED_EXERCISE_TYPES. */
  const MINIMAL: Record<string, Record<string, unknown>> = {
    matching: {
      type: "matching",
      question: "match",
      pairs: [
        { left: "a", right: "1" },
        { left: "b", right: "2" },
        { left: "c", right: "3" },
      ],
    },
    cloze: { type: "cloze", question: "a ___ b", answer: "xx", distractors: [] },
    free_text: { type: "free_text", question: "why?", accepts: ["because"] },
    word_tiles: { type: "word_tiles", question: "order", answer: "one two three" },
    picture_choice: {
      type: "picture_choice",
      question: "pick",
      options: [
        { label: "aa", is_correct: true },
        { label: "bb", is_correct: false },
        { label: "cc", is_correct: false },
      ],
    },
    multiple_choice: {
      type: "multiple_choice",
      question: "pick one",
      options: [
        { text: "aa", is_correct: true },
        { text: "bb", is_correct: false },
      ],
    },
  };

  it("has a parser branch for every allowed type (no type falls through to unknown)", () => {
    for (const type of ALLOWED_EXERCISE_TYPES) {
      const minimal = MINIMAL[type];
      expect(minimal, `add a minimal fixture for ${type}`).toBeDefined();
      const result = parseGeneratedExercises(JSON.stringify({ cards: [minimal] }));
      expect(
        result.cards.map((c) => c.type),
        `type ${type} must parse to a card (has a branch), errors: ${result.errors.join("; ")}`,
      ).toContain(type);
    }
  });
});

describe("parseGeneratedExercises — per-type validation", () => {
  function single(card: unknown): ReturnType<typeof parseGeneratedExercises> {
    return parseGeneratedExercises(JSON.stringify({ cards: [card] }));
  }

  it("skips an unknown exercise type", () => {
    const result = single({ type: "ordering", question: "?", steps: [] });
    expect(result.cards).toEqual([]);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toMatch(/unknown exercise type: ordering/);
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
    const cloze = cards.find((c) => c.type === "cloze");
    expect(cloze && cloze.type === "cloze" && cloze.answer).toBe("all");
  });
});
