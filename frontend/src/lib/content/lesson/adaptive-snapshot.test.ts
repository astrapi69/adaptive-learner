import { describe, it, expect } from "vitest";

import { snapshotAdaptiveLesson } from "./adaptive-snapshot";
import { validateGeneratedLesson } from "../analysis/analysis-to-lesson";
import type { ContentLesson } from "../../../storage/types";

// A live adaptive lesson shape (Phase 53C): non-slug ids + cards:[]
// with exercises referencing source-set cards.
const ADAPTIVE: ContentLesson = {
  id: "adaptive-language-fr-a1-2026-05-29T17:00:00.000Z",
  title: "Adaptive lesson",
  description: null,
  estimated_minutes: 5,
  cards: [],
  steps: [
    {
      id: "adaptive-theory-article:gender-intro",
      type: "theory",
      title: "Articles",
      body: "# Articles\n\nLe / la / les.",
    },
    {
      id: "adaptive-step-0-article:gender-ex-match-1",
      type: "exercise",
      title: null,
      body: null,
      exercise: {
        id: "ex-match-1",
        type: "matching",
        prompt: "Match",
        card_ids: ["phrase-le-chat"],
        pairs: [{ left: "le chat", right: "the cat" }],
        distractors: [],
      },
    },
    {
      id: "adaptive-step-1-spelling:accent-gen-cloze-x",
      type: "exercise",
      title: null,
      body: null,
      exercise: {
        id: "gen-cloze-ex-7-spelling:accent",
        type: "cloze",
        prompt: "Fill the blank",
        card_ids: ["phrase-cafe"],
        sentence: "Je vais au ___.",
        blanks: [{ accept: ["café"] }],
        cloze_mode: "type",
        distractors: [],
      },
    },
  ],
};

describe("snapshotAdaptiveLesson", () => {
  it("produces a schema-valid, self-contained lesson", () => {
    const snap = snapshotAdaptiveLesson(ADAPTIVE);
    expect(() => validateGeneratedLesson(snap)).not.toThrow();
  });

  it("reissues all ids as slug-safe", () => {
    const snap = snapshotAdaptiveLesson(ADAPTIVE);
    const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    expect(snap.id).toMatch(slug);
    for (const step of snap.steps) {
      expect(step.id).toMatch(slug);
      if (step.exercise) expect(step.exercise.id).toMatch(slug);
    }
  });

  it("clears card_ids and keeps cards empty (self-contained)", () => {
    const snap = snapshotAdaptiveLesson(ADAPTIVE);
    expect(snap.cards).toEqual([]);
    for (const step of snap.steps) {
      if (step.exercise) expect(step.exercise.card_ids).toEqual([]);
    }
  });

  it("preserves exercise content (cloze markers, pairs)", () => {
    const snap = snapshotAdaptiveLesson(ADAPTIVE);
    const cloze = snap.steps.find((s) => s.exercise?.type === "cloze");
    expect(cloze?.exercise!.sentence).toBe("Je vais au ___.");
    expect(cloze?.exercise!.blanks).toHaveLength(1);
    const match = snap.steps.find((s) => s.exercise?.type === "matching");
    expect(match?.exercise!.pairs).toHaveLength(1);
  });
});
