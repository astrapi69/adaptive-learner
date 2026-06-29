import { describe, it, expect } from "vitest";

import {
  buildValidationPrompt,
  parseValidationResponse,
  splitIntoBatches,
  ValidationParseError,
  VALIDATION_BATCH_SIZE,
  type ValidationCard,
} from "./content-validator";

function makeCards(n: number): ValidationCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `card-${i}`,
    front: `front-${i}`,
    back: `back-${i}`,
  }));
}

describe("buildValidationPrompt", () => {
  it("includes every card id, front and back", () => {
    const cards = makeCards(3);
    const prompt = buildValidationPrompt(cards, "de", "es", "A1");
    for (const card of cards) {
      expect(prompt).toContain(card.id);
      expect(prompt).toContain(card.front);
      expect(prompt).toContain(card.back);
    }
  });

  it("embeds the source/target language and level in the context line", () => {
    const prompt = buildValidationPrompt(makeCards(1), "de", "es", "B2");
    expect(prompt).toContain("Quellsprache: de");
    expect(prompt).toContain("Zielsprache: es");
    expect(prompt).toContain("Level: B2");
  });

  it("instructs the model to answer with only a JSON array", () => {
    const prompt = buildValidationPrompt(makeCards(1), "de", "es", "A1");
    expect(prompt).toContain("NUR als JSON Array");
    expect(prompt).toContain("Keine Erklaerungen");
  });

  it("carries notes when present", () => {
    const prompt = buildValidationPrompt(
      [{ id: "c1", front: "el libro", back: "das Buch", notes: "maskulin" }],
      "de",
      "es",
      "A1",
    );
    expect(prompt).toContain("maskulin");
  });
});

describe("parseValidationResponse", () => {
  it("parses a plain valid JSON array", () => {
    const raw = JSON.stringify([
      { card_id: "c1", ok: true, issues: [] },
      {
        card_id: "c2",
        ok: false,
        issues: [{ field: "front", problem: "Artikel falsch", suggestion: "el libro" }],
      },
    ]);
    const out = parseValidationResponse(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ card_id: "c1", ok: true, issues: [] });
    expect(out[1].ok).toBe(false);
    expect(out[1].issues[0].suggestion).toBe("el libro");
  });

  it("parses JSON wrapped in markdown fences", () => {
    const raw =
      "Here is the review:\n```json\n" +
      JSON.stringify([{ card_id: "c1", ok: true, issues: [] }]) +
      "\n```\nHope this helps!";
    const out = parseValidationResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0].card_id).toBe("c1");
  });

  it("extracts the array even with surrounding prose", () => {
    const raw = `The result is [{"card_id":"c1","ok":true,"issues":[]}] done.`;
    const out = parseValidationResponse(raw);
    expect(out).toHaveLength(1);
  });

  it("tolerates trailing commas", () => {
    const raw = '[{"card_id":"c1","ok":true,"issues":[]},]';
    const out = parseValidationResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0].card_id).toBe("c1");
  });

  it("recovers complete objects from a truncated array", () => {
    const raw =
      '[{"card_id":"c1","ok":true,"issues":[]},' +
      '{"card_id":"c2","ok":false,"issues":[{"field":"back","problem":"x","sugg';
    const out = parseValidationResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0].card_id).toBe("c1");
  });

  it("treats an empty array as all-OK", () => {
    expect(parseValidationResponse("[]")).toEqual([]);
  });

  it("treats an empty/whitespace response as all-OK", () => {
    expect(parseValidationResponse("   ")).toEqual([]);
    expect(parseValidationResponse("")).toEqual([]);
  });

  it("throws ValidationParseError on broken non-array JSON", () => {
    expect(() => parseValidationResponse("this is not json at all")).toThrow(
      ValidationParseError,
    );
  });

  it("forces ok=false when issues are present despite ok=true", () => {
    const raw =
      '[{"card_id":"c1","ok":true,"issues":[{"field":"back","problem":"p","suggestion":"s"}]}]';
    const out = parseValidationResponse(raw);
    expect(out[0].ok).toBe(false);
  });

  it("drops rows without a usable card_id", () => {
    const raw = '[{"ok":true,"issues":[]},{"card_id":"c2","ok":true,"issues":[]}]';
    const out = parseValidationResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0].card_id).toBe("c2");
  });
});

describe("splitIntoBatches", () => {
  it("splits 25 cards into 3 batches of 10+10+5", () => {
    const batches = splitIntoBatches(makeCards(25));
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(10);
    expect(batches[1]).toHaveLength(10);
    expect(batches[2]).toHaveLength(5);
  });

  it("uses the default batch size of 10", () => {
    expect(VALIDATION_BATCH_SIZE).toBe(10);
    expect(splitIntoBatches(makeCards(10))).toHaveLength(1);
    expect(splitIntoBatches(makeCards(11))).toHaveLength(2);
  });

  it("honours a custom batch size", () => {
    const batches = splitIntoBatches(makeCards(7), 3);
    expect(batches.map((b) => b.length)).toEqual([3, 3, 1]);
  });

  it("returns an empty list for no cards", () => {
    expect(splitIntoBatches([])).toEqual([]);
  });
});
