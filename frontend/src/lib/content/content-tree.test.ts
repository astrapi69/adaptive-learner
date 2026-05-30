import { describe, expect, it } from "vitest";

import type { ContentSetEntry } from "../../storage/types";
import { baseLanguage, buildContentTree } from "./content-tree";

function entry(over: Partial<ContentSetEntry>): ContentSetEntry {
  return {
    source: "astrapi69/adaptive-learner-content",
    branch: "main",
    id: over.id ?? "x",
    title: over.title ?? "Title",
    title_native: null,
    language: over.target_language ?? "fr",
    target_language: over.target_language ?? "fr",
    source_language: over.source_language ?? "en",
    level: over.level ?? "A1",
    domain: "language",
    version: "1.0.0",
    lesson_count: 3,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: null,
    update_available: false,
    ...over,
  };
}

describe("baseLanguage", () => {
  it("strips region subtag and lowercases", () => {
    expect(baseLanguage("de-AT")).toBe("de");
    expect(baseLanguage("FR")).toBe("fr");
    expect(baseLanguage("zh-Hans")).toBe("zh");
    expect(baseLanguage("")).toBe("");
  });
});

describe("buildContentTree", () => {
  const sets = [
    entry({ id: "fr-a1-from-de", target_language: "fr", source_language: "de", level: "A1" }),
    entry({ id: "fr-a2-from-de", target_language: "fr", source_language: "de", level: "A2" }),
    entry({ id: "es-a1-from-de", target_language: "es", source_language: "de", level: "A1" }),
    entry({ id: "fr-a1-from-en", target_language: "fr", source_language: "en", level: "A1" }),
    entry({ id: "es-a1-from-en", target_language: "es", source_language: "en", level: "A1" }),
  ];

  it("puts the active source language in primary, others in other", () => {
    const tree = buildContentTree(sets, ["de"]);
    expect(tree.primary.map((g) => g.sourceLanguage)).toEqual(["de"]);
    expect(tree.other.map((g) => g.sourceLanguage)).toEqual(["en"]);
  });

  it("groups source -> target -> level", () => {
    const tree = buildContentTree(sets, ["de"]);
    const de = tree.primary[0];
    expect(de.setCount).toBe(3);
    // Targets sorted alphabetically: es, fr
    expect(de.targets.map((t) => t.targetLanguage)).toEqual(["es", "fr"]);
    const fr = de.targets.find((t) => t.targetLanguage === "fr")!;
    // Levels sorted CEFR: A1 before A2
    expect(fr.levels.map((l) => l.level)).toEqual(["A1", "A2"]);
    expect(fr.setCount).toBe(2);
  });

  it("honours activeSources order for primary groups", () => {
    const tree = buildContentTree(sets, ["en", "de"]);
    expect(tree.primary.map((g) => g.sourceLanguage)).toEqual(["en", "de"]);
    expect(tree.other).toHaveLength(0);
  });

  it("matches the app language by base subtag (de-AT -> de)", () => {
    const tree = buildContentTree(sets, ["de-AT"]);
    expect(tree.primary.map((g) => g.sourceLanguage)).toEqual(["de"]);
  });

  it("skips active source languages with no sets", () => {
    const tree = buildContentTree(sets, ["ja", "de"]);
    expect(tree.primary.map((g) => g.sourceLanguage)).toEqual(["de"]);
  });

  it("sorts unknown levels after the CEFR ladder", () => {
    const mixed = [
      entry({ id: "a", source_language: "de", level: "beginner" }),
      entry({ id: "b", source_language: "de", level: "A1" }),
    ];
    const tree = buildContentTree(mixed, ["de"]);
    const fr = tree.primary[0].targets[0];
    expect(fr.levels.map((l) => l.level)).toEqual(["A1", "beginner"]);
  });
});
