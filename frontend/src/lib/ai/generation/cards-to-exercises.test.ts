/**
 * AIX-02 (EXP-036) — tests for the AI-cards -> exercises quality gate.
 */

import { describe, expect, it } from "vitest";

import { cardsToExercises } from "./cards-to-exercises";
import type { ValidCard } from "./exercise-generation-parser";

describe("cardsToExercises", () => {
  it("maps a matching card to a renderable matching exercise", () => {
    const cards: ValidCard[] = [
      {
        type: "matching",
        question: "Match each module to its purpose.",
        pairs: [
          { left: "file", right: "manage files" },
          { left: "copy", right: "copy files" },
          { left: "service", right: "manage services" },
        ],
      },
    ];
    const { exercises, skipped } = cardsToExercises(cards);
    expect(skipped).toBe(0);
    expect(exercises).toHaveLength(1);
    expect(exercises[0]).toMatchObject({
      id: "ai-ex-1-matching",
      type: "matching",
      prompt: "Match each module to its purpose.",
      card_ids: [],
      distractors: [],
    });
    expect(exercises[0].pairs).toHaveLength(3);
  });

  it("maps a free_text card with accepts + distractors", () => {
    const cards: ValidCard[] = [
      {
        type: "free_text",
        question: "What does idempotence mean?",
        accepts: ["running it again changes nothing"],
        distractors: ["it runs faster each time"],
      },
    ];
    const { exercises } = cardsToExercises(cards);
    expect(exercises[0]).toMatchObject({
      type: "free_text",
      accept: ["running it again changes nothing"],
      distractors: ["it runs faster each time"],
    });
  });

  it("maps a single-blank cloze (select mode when distractors exist)", () => {
    const cards: ValidCard[] = [
      {
        type: "cloze",
        question: "hosts: ___ targets every host.",
        answer: "all",
        distractors: ["localhost", "webservers"],
      },
    ];
    const { exercises } = cardsToExercises(cards, { clozePrompt: "Fill in the blank." });
    expect(exercises[0]).toMatchObject({
      type: "cloze",
      prompt: "Fill in the blank.",
      sentence: "hosts: ___ targets every host.",
      cloze_mode: "select",
      distractors: ["localhost", "webservers"],
    });
    expect(exercises[0].blanks).toEqual([{ accept: ["all"] }]);
  });

  it("uses type mode for a cloze without distractors", () => {
    const cards: ValidCard[] = [
      { type: "cloze", question: "state: ___", answer: "stopped", distractors: [] },
    ];
    const { exercises } = cardsToExercises(cards);
    expect(exercises[0].cloze_mode).toBe("type");
  });

  it("drops a cloze with more than one blank", () => {
    const cards: ValidCard[] = [
      { type: "cloze", question: "___ and ___", answer: "a", distractors: [] },
    ];
    const { exercises, skipped } = cardsToExercises(cards);
    expect(exercises).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("splits a word_tiles answer into tiles", () => {
    const cards: ValidCard[] = [
      { type: "word_tiles", question: "Arrange the words.", answer: "the cat sat" },
    ];
    const { exercises } = cardsToExercises(cards);
    expect(exercises[0]).toMatchObject({ type: "word_tiles", tiles: ["the", "cat", "sat"] });
  });

  it("maps a multiple_choice card to a renderable MC exercise (#2353)", () => {
    const cards: ValidCard[] = [
      {
        type: "multiple_choice",
        question: "Which of these are Ansible modules?",
        options: [
          { text: "copy", is_correct: true },
          { text: "service", is_correct: true },
          { text: "banana", is_correct: false },
        ],
        multiple: true,
      },
    ];
    const { exercises, skipped } = cardsToExercises(cards);
    expect(skipped).toBe(0);
    expect(exercises[0]).toMatchObject({
      id: "ai-ex-1-multiple-choice",
      type: "multiple_choice",
      prompt: "Which of these are Ansible modules?",
      multiple: true,
      card_ids: [],
      distractors: [],
    });
    expect(exercises[0].options).toEqual([
      { text: "copy", correct: true },
      { text: "service", correct: true },
      { text: "banana", correct: false },
    ]);
  });

  it("drops a picture_choice card (no image sources)", () => {
    const cards: ValidCard[] = [
      {
        type: "picture_choice",
        question: "Pick the right one.",
        options: [
          { label: "a", is_correct: true },
          { label: "b", is_correct: false },
          { label: "c", is_correct: false },
        ],
      },
    ];
    const { exercises, skipped } = cardsToExercises(cards);
    expect(exercises).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("re-ids surviving exercises sequentially and slug-safe", () => {
    const cards: ValidCard[] = [
      { type: "free_text", question: "Q1", accepts: ["a"], distractors: [] },
      {
        type: "picture_choice",
        question: "skip me",
        options: [
          { label: "a", is_correct: true },
          { label: "b", is_correct: false },
          { label: "c", is_correct: false },
        ],
      },
      { type: "word_tiles", question: "Q2", answer: "one two" },
    ];
    const { exercises, skipped } = cardsToExercises(cards);
    expect(skipped).toBe(1);
    expect(exercises.map((e) => e.id)).toEqual(["ai-ex-1-free-text", "ai-ex-2-word-tiles"]);
  });

  it("returns nothing for an empty card list", () => {
    expect(cardsToExercises([])).toEqual({ exercises: [], skipped: 0 });
  });
});
