import { describe, expect, it } from "vitest";

import type { ContentLesson } from "../../storage/types";
import type { ValidationMeta } from "./content-validator";
import {
  buildAiValidationMessages,
  parseAiValidationResult,
} from "./ai-content-validator";

const META: ValidationMeta = {
  title: "Französisch A1",
  title_native: "Français A1",
  target_language: "fr",
  source_language: "de",
  level: "A1",
};

const LESSON: ContentLesson = {
  id: "01",
  title: "Begrüßung",
  estimated_minutes: 10,
  cards: [{ id: "c1", front: "Bonjour", back: "Guten Tag", tags: [] }],
  steps: [{ id: "intro", type: "theory", body: "# Begrüßung" }],
};

describe("buildAiValidationMessages", () => {
  it("emits a system + user message with the pair and the lesson", () => {
    const msgs = buildAiValidationMessages(META, [LESSON]);
    expect(msgs.map((m) => m.role)).toEqual(["system", "user"]);
    expect(msgs[0].content).toContain("JSON");
    expect(msgs[0].content).toContain("fr");
    expect(msgs[1].content).toContain("Bonjour");
    expect(msgs[1].content).toContain("Guten Tag");
  });
});

describe("parseAiValidationResult", () => {
  it("parses a fenced clean response", () => {
    const raw =
      '```json\n{"overall":"pass","translation_issues":[],"distractor_issues":[],"grammar_issues":[],"level_issues":[],"cultural_flags":[],"quality_score":0.9}\n```';
    const r = parseAiValidationResult(raw);
    expect(r).not.toBeNull();
    expect(r!.overall).toBe("pass");
    expect(r!.quality_score).toBe(0.9);
  });

  it("infers review_needed and keeps issue rows", () => {
    const raw =
      '{"translation_issues":[{"card_id":"c1","issue":"falsch","suggestion":"Guten Morgen"}],"quality_score":0.3}';
    const r = parseAiValidationResult(raw)!;
    expect(r.overall).toBe("review_needed");
    expect(r.translation_issues[0].suggestion).toBe("Guten Morgen");
  });

  it("clamps the score and drops malformed issues", () => {
    const r = parseAiValidationResult(
      '{"quality_score":9,"grammar_issues":["junk",{"step_id":""}]}',
    )!;
    expect(r.quality_score).toBe(1);
    expect(r.grammar_issues).toEqual([]);
  });

  it("returns null when there is no JSON object", () => {
    expect(parseAiValidationResult("sorry, no json")).toBeNull();
  });
});
