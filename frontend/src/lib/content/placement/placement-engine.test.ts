/**
 * Tests for the smart placement engine (Phase 64A).
 *
 * Pins: auto-numbering (next lesson number from existing files),
 * filename suggestion, new-set detection (you're the first), full
 * placement for known + new sets, and the advisory content
 * auto-detection (target language, level estimate, topic suggestion).
 */

import { describe, expect, it } from "vitest";

import type { ContentLessonCard, ContentSetEntry } from "../../../storage/types";
import {
  autoDetectTargetLanguage,
  computePlacement,
  estimateLevel,
  nextLessonNumber,
  setExistsInTree,
  suggestFilename,
  suggestTopic,
} from "./placement-engine";

function setEntry(over: Partial<ContentSetEntry>): ContentSetEntry {
  return {
    source: "github",
    branch: "main",
    id: "fr-a1-from-de",
    title: "Französisch A1",
    language: "fr",
    target_language: "fr",
    source_language: "de",
    level: "A1",
    domain: "language",
    version: "1.0.0",
    lesson_count: 15,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: null,
    update_available: false,
    ...over,
  };
}

function card(front: string, tags: string[] = []): ContentLessonCard {
  return { id: front, front, back: front, tags };
}

describe("nextLessonNumber", () => {
  it("returns 1 for an empty set", () => {
    expect(nextLessonNumber([])).toBe(1);
  });

  it("returns max leading number + 1", () => {
    expect(
      nextLessonNumber(["01-a.json", "02-b.json", "15-o.json"]),
    ).toBe(16);
  });

  it("handles gaps (uses the max, not the count)", () => {
    expect(nextLessonNumber(["01-a.json", "07-b.json"])).toBe(8);
  });

  it("ignores files without a numeric prefix", () => {
    expect(
      nextLessonNumber(["readme.json", "03-c.json", "notes.json"]),
    ).toBe(4);
  });

  it("accepts underscore separators", () => {
    expect(nextLessonNumber(["01_intro.json"])).toBe(2);
  });
});

describe("suggestFilename", () => {
  it("zero-pads single-digit numbers and slugs the topic", () => {
    expect(suggestFilename(7, "Konjugation Präteritum")).toBe(
      "07-konjugation-praeteritum.json",
    );
  });

  it("does not pad two-digit numbers", () => {
    expect(suggestFilename(16, "Farben")).toBe("16-farben.json");
  });

  it("falls back to a generic slug when the topic is unslugable", () => {
    expect(suggestFilename(3, "!!!")).toBe("03-lektion.json");
  });
});

describe("setExistsInTree / new-set detection", () => {
  const known = [
    setEntry({ id: "fr-a1-from-de", source_language: "de", target_language: "fr", level: "A1" }),
    setEntry({ id: "es-a1-from-en", source_language: "en", target_language: "es", level: "A1" }),
  ];

  it("finds an existing published set for the pair + level", () => {
    expect(
      setExistsInTree({ source_language: "de", target_language: "fr", level: "A1" }, known),
    ).toBe(true);
  });

  it("reports no set for a missing level (A2)", () => {
    expect(
      setExistsInTree({ source_language: "de", target_language: "fr", level: "A2" }, known),
    ).toBe(false);
  });

  it("reports no set for a missing pair", () => {
    expect(
      setExistsInTree({ source_language: "de", target_language: "it", level: "A1" }, known),
    ).toBe(false);
  });

  it("ignores the sharer's own user-generated drafts", () => {
    const draftOnly = [
      setEntry({ source: "user-generated", source_language: "de", target_language: "it", level: "A1" }),
    ];
    expect(
      setExistsInTree({ source_language: "de", target_language: "it", level: "A1" }, draftOnly),
    ).toBe(false);
  });
});

describe("computePlacement", () => {
  const known = [setEntry({ source_language: "de", target_language: "fr", level: "A1" })];

  it("places a new lesson next to existing ones in a known set", () => {
    const result = computePlacement({
      meta: { source_language: "de", target_language: "fr", level: "A1" },
      topic: "Konjugation Präteritum",
      existingLessonFilenames: Array.from({ length: 15 }, (_, i) => `${String(i + 1).padStart(2, "0")}-x.json`),
      knownSets: known,
    });
    expect(result.path).toBe("sets/de/fr-a1");
    expect(result.filename).toBe("16-konjugation-praeteritum.json");
    expect(result.number).toBe(16);
    expect(result.numberLabel).toBe("16");
    expect(result.isNewSet).toBe(false);
    expect(result.existingLessonCount).toBe(15);
  });

  it("flags a brand-new set (you're the first)", () => {
    const result = computePlacement({
      meta: { source_language: "de", target_language: "it", level: "A1" },
      topic: "Begrüßung",
      existingLessonFilenames: [],
      knownSets: known,
    });
    expect(result.path).toBe("sets/de/it-a1");
    expect(result.filename).toBe("01-begruessung.json");
    expect(result.isNewSet).toBe(true);
    expect(result.existingLessonCount).toBe(0);
  });
});

describe("autoDetectTargetLanguage", () => {
  it("detects from the topic/title text", () => {
    expect(autoDetectTargetLanguage("Französisch Grammatik", [])).toBe("fr");
  });

  it("detects a non-Latin target from card fronts when the topic is silent", () => {
    expect(
      autoDetectTargetLanguage("My deck", [card("こんにちは"), card("ありがとう")]),
    ).toBe("ja");
  });

  it("returns null when it cannot tell (Latin script, no topic hint)", () => {
    expect(autoDetectTargetLanguage("My deck", [card("bonjour")])).toBeNull();
  });
});

describe("estimateLevel", () => {
  it("defaults to A1 for an empty deck", () => {
    expect(estimateLevel([])).toBe("A1");
  });

  it("rates single-word cards as A1", () => {
    expect(estimateLevel([card("chat"), card("chien"), card("oiseau")])).toBe("A1");
  });

  it("rates long sentences above A1", () => {
    const long = card(
      "je voudrais réserver une table pour quatre personnes ce soir",
    );
    expect(["B1", "B2"]).toContain(estimateLevel([long, long, long]));
  });
});

describe("suggestTopic", () => {
  it("uses the dominant card tag when it covers enough of the deck", () => {
    const cards = [
      card("rouge", ["color"]),
      card("bleu", ["color"]),
      card("vert", ["color"]),
    ];
    expect(suggestTopic(cards, "Lektion 12")).toBe("color");
  });

  it("falls back to the title when no tag dominates", () => {
    const cards = [card("rouge", ["color"]), card("manger", ["verb"]), card("trois", ["number"])];
    expect(suggestTopic(cards, "Gemischte Wörter")).toBe("Gemischte Wörter");
  });
});
