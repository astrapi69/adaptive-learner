import { describe, expect, it } from "vitest";

import type { ContentSetEntry } from "../../../storage/types";
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

  // --- v1.3: non-language domain grouping (Sprachen vs Wissen) ---

  it("routes non-language domain sets into the knowledge section", () => {
    const mixed = [
      entry({ id: "fr", source_language: "de", target_language: "fr" }),
      entry({
        id: "psych",
        source_language: "de",
        target_language: "de",
        level: "intro",
        domain: "psychology",
        title: "Psychologie",
      }),
      entry({
        id: "py",
        source_language: "de",
        target_language: "de",
        level: "basics",
        domain: "programming",
        title: "Python Grundlagen",
      }),
    ];
    const tree = buildContentTree(mixed, ["de"]);
    // Language set stays in the source tree; domain sets do NOT.
    expect(tree.primary[0].targets.map((t) => t.targetLanguage)).toEqual([
      "fr",
    ]);
    // Knowledge groups: alphabetical by domain.
    expect(tree.knowledge.map((g) => g.domain)).toEqual([
      "programming",
      "psychology",
    ]);
    expect(tree.knowledge[0].sets.map((s) => s.id)).toEqual(["py"]);
  });

  it("leaves knowledge empty for a language-only library", () => {
    const tree = buildContentTree(
      [entry({ id: "fr", source_language: "de" })],
      ["de"],
    );
    expect(tree.knowledge).toEqual([]);
  });

  it("treats a missing/blank domain as 'language'", () => {
    const tree = buildContentTree(
      [entry({ id: "x", source_language: "de", domain: "" })],
      ["de"],
    );
    expect(tree.knowledge).toEqual([]);
    expect(tree.primary).toHaveLength(1);
  });

  // --- #1241: freshly downloaded set first within a level / domain group ---
  // The #1211/#1212 fix surfaced ``downloaded_at`` and the shared comparator
  // but only wired it into buildPersonalPath. The Content browser renders
  // buildContentTree, which must apply the same "fresh download first"
  // ordering WITHIN each level group and each knowledge domain group while
  // keeping the structural source -> target -> level grouping intact.

  it("orders a level group by download time (newest first), not alphabetically (#1241)", () => {
    const sameLevel = [
      entry({
        id: "alpha",
        source_language: "de",
        target_language: "fr",
        level: "A1",
        title: "Alpha", // alphabetically first
        downloaded_at: "2026-06-01T00:00:00.000Z", // older download
      }),
      entry({
        id: "zeta",
        source_language: "de",
        target_language: "fr",
        level: "A1",
        title: "Zeta", // alphabetically last
        downloaded_at: "2026-06-28T00:00:00.000Z", // freshest download
      }),
    ];
    const tree = buildContentTree(sameLevel, ["de"]);
    const level = tree.primary[0].targets[0].levels[0];
    // Freshly downloaded "Zeta" must surface above the older "Alpha".
    expect(level.sets.map((s) => s.id)).toEqual(["zeta", "alpha"]);
  });

  it("orders a knowledge domain group by download time (newest first) (#1241)", () => {
    const sameDomain = [
      entry({
        id: "aardvark",
        source_language: "de",
        target_language: "de",
        level: "intro",
        domain: "psychology",
        title: "Aardvark",
        downloaded_at: "2026-06-01T00:00:00.000Z",
      }),
      entry({
        id: "yak",
        source_language: "de",
        target_language: "de",
        level: "intro",
        domain: "psychology",
        title: "Yak",
        downloaded_at: "2026-06-28T00:00:00.000Z",
      }),
    ];
    const tree = buildContentTree(sameDomain, ["de"]);
    expect(tree.knowledge[0].sets.map((s) => s.id)).toEqual(["yak", "aardvark"]);
  });

  it("falls back to a stable title sort when download times are missing/equal (#1241)", () => {
    const noTimestamps = [
      entry({ id: "zeta", source_language: "de", level: "A1", title: "Zeta" }),
      entry({ id: "alpha", source_language: "de", level: "A1", title: "Alpha" }),
      entry({
        id: "beta",
        source_language: "de",
        level: "A1",
        title: "Beta",
        downloaded_at: null,
      }),
    ];
    const tree = buildContentTree(noTimestamps, ["de"]);
    const level = tree.primary[0].targets[0].levels[0];
    // No timestamps anywhere -> deterministic alphabetical title order.
    expect(level.sets.map((s) => s.title)).toEqual(["Alpha", "Beta", "Zeta"]);
  });

  it("API mode (no downloaded_at on any set) sorts by title without crashing (#1241)", () => {
    const apiSets = [
      entry({ id: "fr-z", source_language: "de", level: "A1", title: "Zebra" }),
      entry({ id: "fr-a", source_language: "de", level: "A1", title: "Apple" }),
    ];
    expect(() => buildContentTree(apiSets, ["de"])).not.toThrow();
    const tree = buildContentTree(apiSets, ["de"]);
    const level = tree.primary[0].targets[0].levels[0];
    expect(level.sets.map((s) => s.title)).toEqual(["Apple", "Zebra"]);
  });
});
