import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { _resetDbForTests } from "../dexie/db";
import { dexiePluginSettings } from "../dexie/dexie-plugin-settings";
import {
  DEFAULT_EXTRACTION_LIMIT,
  aiExtractCards,
  buildExtractionPrompt,
  parseExtractedCards,
  resolveExtractionLimit,
} from "./anki-extraction";

const aiCompleteMock = vi.hoisted(() => vi.fn(async () => "[]"));
vi.mock("../ai/ai-providers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ai/ai-providers")>()),
  aiComplete: aiCompleteMock,
}));

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

describe("resolveExtractionLimit (#3435)", () => {
  it.each([
    ["a positive integer", 12, 12],
    ["a numeric string", "12", 12],
    ["zero", 0, DEFAULT_EXTRACTION_LIMIT],
    ["a negative number", -3, DEFAULT_EXTRACTION_LIMIT],
    ["a fraction", 2.5, DEFAULT_EXTRACTION_LIMIT],
    ["a boolean", true, DEFAULT_EXTRACTION_LIMIT],
    ["a missing value", undefined, DEFAULT_EXTRACTION_LIMIT],
    ["text", "many", DEFAULT_EXTRACTION_LIMIT],
  ])("reads %s as the right limit", (_label, value, expected) => {
    expect(resolveExtractionLimit(value)).toBe(expected);
  });
});

describe("aiExtractCards uses the plugin's extraction_limit (#3435)", () => {
  const config = { provider: "anthropic" as const, model: "m", apiKey: "k" };

  beforeEach(async () => {
    await _resetDbForTests();
    aiCompleteMock.mockClear();
  });

  afterEach(async () => {
    await _resetDbForTests();
  });

  function promptSent(): string {
    const call = aiCompleteMock.mock.calls[0] as unknown as [
      { messages: { content: string }[] },
    ];
    return call[0].messages[0].content;
  }

  it("asks for the bundled default on a fresh install", async () => {
    await aiExtractCards(config, "material");
    expect(promptSent()).toContain(`extract up to ${DEFAULT_EXTRACTION_LIMIT} high-value`);
  });

  it("asks for a stored limit", async () => {
    await dexiePluginSettings.update("anki", { settings: { extraction_limit: 3 } });
    await aiExtractCards(config, "material");
    expect(promptSent()).toContain("extract up to 3 high-value");
  });
});
