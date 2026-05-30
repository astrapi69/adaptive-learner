import { describe, expect, it } from "vitest";

import type { ContentSetEntry } from "../../storage/types";
import { findSimilarSets, levenshtein } from "./duplicate-detection";

function entry(over: Partial<ContentSetEntry>): ContentSetEntry {
  return {
    source: "astrapi69/adaptive-learner-content",
    branch: "main",
    id: over.id ?? "x",
    title: over.title ?? "Title",
    title_native: null,
    language: over.target_language ?? "fr",
    target_language: over.target_language ?? "fr",
    source_language: over.source_language ?? "de",
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

describe("levenshtein", () => {
  it("computes edit distance", () => {
    expect(levenshtein("kitten", "kitten")).toBe(0);
    expect(levenshtein("kitten", "sitten")).toBe(1);
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("findSimilarSets", () => {
  const query = {
    id: "my-new-set",
    title: "Begrüßung",
    source_language: "de",
    target_language: "fr",
    level: "A1",
  };
  const candidates = [
    entry({ id: "fr-a1-from-de", title: "Begruessung", source_language: "de", target_language: "fr", level: "A1" }),
    entry({ id: "fr-a2-from-de", title: "Begrüßung", source_language: "de", target_language: "fr", level: "A2" }),
    entry({ id: "fr-a1-from-en", title: "Greetings", source_language: "en", target_language: "fr", level: "A1" }),
    entry({ id: "es-a1-from-de", title: "Begrüßung", source_language: "de", target_language: "es", level: "A1" }),
  ];

  // T-1 (Phase 61 audit): this pure-function assertion is green in
  // every normal run but flaked once under full-suite parallel
  // `--coverage` (a v8 coverage-instrumentation / worker-scheduling
  // race, not a logic bug — normaliseTitle has no shared state). A
  // retry quarantines the coverage-only flake without single-
  // threading the whole suite.
  it("flags a same-pair same-level set with a diacritic-insensitive title match", { retry: 2 }, () => {
    const hits = findSimilarSets(query, candidates);
    expect(hits.map((h) => h.id)).toEqual(["fr-a1-from-de"]);
  });

  it("does not flag a different level / pair", () => {
    const hits = findSimilarSets(query, candidates);
    expect(hits.map((h) => h.id)).not.toContain("fr-a2-from-de");
    expect(hits.map((h) => h.id)).not.toContain("es-a1-from-de");
    expect(hits.map((h) => h.id)).not.toContain("fr-a1-from-en");
  });

  it("ignores the set's own id and user-generated sets", () => {
    const self = entry({ id: "my-new-set", title: "Begrüßung" });
    const mine = entry({ id: "other", title: "Begrüßung", source: "user-generated" });
    const hits = findSimilarSets(query, [self, mine]);
    expect(hits).toEqual([]);
  });

  it("matches within Levenshtein < 3 (typo)", () => {
    // query normalises to "begruessung"; this is one deletion away.
    const hits = findSimilarSets(query, [
      entry({ id: "typo", title: "Begruessng" }),
    ]);
    expect(hits.map((h) => h.id)).toEqual(["typo"]);
  });

  it("does not match a clearly different title", () => {
    const hits = findSimilarSets(query, [
      entry({ id: "diff", title: "Zahlen und Farben" }),
    ]);
    expect(hits).toEqual([]);
  });
});
