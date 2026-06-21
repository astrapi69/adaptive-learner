import { describe, it, expect } from "vitest";

import {
  buildExtractionPrompt,
  parseExtractedCards,
} from "./anki-extraction";

describe("buildExtractionPrompt", () => {
  it("injects the limit and the material", () => {
    const prompt = buildExtractionPrompt("Ansible playbooks are YAML.", 5);
    expect(prompt).toContain("extract up to 5 high-value flashcards");
    expect(prompt).toContain("Ansible playbooks are YAML.");
  });

  it("clips the material to 8000 chars", () => {
    const huge = "x".repeat(20000);
    const prompt = buildExtractionPrompt(huge);
    // The material slice is 8000 chars; the prompt scaffold adds the rest.
    expect(prompt).toContain("x".repeat(8000));
    expect(prompt).not.toContain("x".repeat(8001));
  });
});

describe("parseExtractedCards", () => {
  it("parses a clean basic + cloze array", () => {
    const raw = JSON.stringify([
      { type: "basic", front: "What is Ansible?", back: "An automation tool", tags: ["it"] },
      { type: "cloze", front: "Ansible uses {{c1::YAML}}", back: "", tags: [] },
    ]);
    const cards = parseExtractedCards(raw);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({
      card_type: "basic",
      front: "What is Ansible?",
      back: "An automation tool",
      tags: ["it"],
    });
    expect(cards[1].card_type).toBe("cloze");
  });

  it("strips a ```json fence", () => {
    const raw = '```json\n[{"type":"basic","front":"Q","back":"A","tags":[]}]\n```';
    expect(parseExtractedCards(raw)).toHaveLength(1);
  });

  it("skips rows with no front, unknown type, or non-object", () => {
    const raw = JSON.stringify([
      { type: "basic", front: "", back: "A" },
      { type: "essay", front: "Q", back: "A" },
      "not an object",
      { type: "basic", front: "Keep", back: "A" },
    ]);
    const cards = parseExtractedCards(raw);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe("Keep");
  });

  it("lowercases + trims tags and drops empties", () => {
    const raw = JSON.stringify([
      { type: "basic", front: "Q", back: "A", tags: [" IT ", "", "DevOps"] },
    ]);
    expect(parseExtractedCards(raw)[0].tags).toEqual(["it", "devops"]);
  });

  it("returns [] on invalid JSON, non-array, or empty input", () => {
    expect(parseExtractedCards("not json")).toEqual([]);
    expect(parseExtractedCards('{"front":"Q"}')).toEqual([]);
    expect(parseExtractedCards("")).toEqual([]);
    expect(parseExtractedCards(null)).toEqual([]);
  });
});
