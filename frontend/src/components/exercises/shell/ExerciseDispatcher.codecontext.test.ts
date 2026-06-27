import { describe, expect, it } from "vitest";

import { resolveCodeContext } from "./ExerciseDispatcher";
import type {
  ContentLessonCard,
  ContentLessonExercise,
} from "../../../storage/types";

function card(over: Partial<ContentLessonCard>): ContentLessonCard {
  return { id: "c1", front: "f", back: "b", tags: [], ...over };
}

function exercise(cardIds: string[]): ContentLessonExercise {
  return {
    id: "ex1",
    type: "free_text",
    prompt: "p",
    card_ids: cardIds,
  } as ContentLessonExercise;
}

describe("resolveCodeContext (schema v1.3)", () => {
  it("flags code mode for a code card + carries its language", () => {
    const cards = [card({ id: "c1", media_type: "code", code_language: "python" })];
    expect(resolveCodeContext(exercise(["c1"]), cards)).toEqual({
      codeMode: true,
      codeLanguage: "python",
    });
  });

  it("flags code mode for a formula card", () => {
    const cards = [card({ id: "c1", media_type: "formula", code_language: "excel" })];
    expect(resolveCodeContext(exercise(["c1"]), cards)).toEqual({
      codeMode: true,
      codeLanguage: "excel",
    });
  });

  it("is plain text for a text card / missing media_type", () => {
    const cards = [card({ id: "c1", media_type: "text" })];
    expect(resolveCodeContext(exercise(["c1"]), cards).codeMode).toBe(false);
    const plain = [card({ id: "c1" })];
    expect(resolveCodeContext(exercise(["c1"]), plain).codeMode).toBe(false);
  });

  it("is plain text when the card is not found / no card_ids", () => {
    expect(resolveCodeContext(exercise(["missing"]), []).codeMode).toBe(false);
    expect(resolveCodeContext(exercise([]), []).codeMode).toBe(false);
  });
});
