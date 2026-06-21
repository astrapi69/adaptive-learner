import { describe, expect, it } from "vitest";

import type { ContentLesson, ContentSetEntry } from "../../../storage/types";
import {
  compareLessons,
  detectDuplicate,
  extractSupplement,
  findSimilarSets,
  levenshtein,
  markAsVariation,
} from "./duplicate-detection";

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

// ---------------------------------------------------------------------------
// Lesson-level detection (Phase 64B)
// ---------------------------------------------------------------------------

/** Exercise step on the given local card ids. */
function exStep(id: string, type: string, cardIds: string[]) {
  return {
    id,
    type: "exercise" as const,
    exercise: {
      id,
      type: type as never,
      prompt: id,
      card_ids: cardIds,
      distractors: [] as string[],
    },
  };
}

/** Build a lesson. ``cards`` are [front, back] pairs; their local id is
 *  ``c{n}`` so independently-built lessons get DIFFERENT ids but the
 *  same front/back text (which is what the detector compares on). */
function lesson(
  id: string,
  cards: Array<[string, string]>,
  steps: ReturnType<typeof exStep>[] = [],
): ContentLesson {
  return {
    id,
    title: id,
    estimated_minutes: 10,
    cards: cards.map(([front, back], i) => ({
      id: `${id}-c${i}`,
      front,
      back,
      tags: [],
    })),
    steps,
  };
}

const TEN: Array<[string, string]> = Array.from({ length: 10 }, (_, i) => [
  `word${i}`,
  `mean${i}`,
]);

describe("compareLessons + detectDuplicate", () => {
  const candidate = lesson("orig", TEN);

  it("reports no match for a completely different lesson", () => {
    const query = lesson(
      "new",
      [["alpha", "a"], ["beta", "b"], ["gamma", "g"]],
    );
    const result = detectDuplicate(query, [candidate]);
    expect(result.tier).toBe("none");
    expect(result.match).toBeNull();
    expect(result.comparisons[0].cardOverlap).toBe(0);
  });

  it("flags a near-duplicate at >= 90% card overlap", () => {
    // Same 10 fronts/backs, different local ids -> overlap 1.0.
    const query = lesson("mine", TEN);
    const result = detectDuplicate(query, [candidate]);
    expect(result.tier).toBe("near_duplicate");
    expect(result.match?.candidateId).toBe("orig");
    expect(result.match?.cardOverlap).toBe(1);
  });

  it("flags a similar lesson at >= 70% (but < 90%) card overlap", () => {
    // 7 of the 10 query cards exist in the candidate -> 0.7.
    const query = lesson("mine", [
      ...TEN.slice(0, 7),
      ["extra1", "x1"],
      ["extra2", "x2"],
      ["extra3", "x3"],
    ]);
    const result = detectDuplicate(query, [candidate]);
    expect(result.tier).toBe("similar");
    expect(result.match?.cardOverlap).toBeCloseTo(0.7, 5);
  });

  it("computes exercise overlap by type + targeted card keys", () => {
    const cand = lesson("orig", TEN, [
      exStep("e1", "free_text", ["orig-c0"]),
      exStep("e2", "matching", ["orig-c1", "orig-c2"]),
    ]);
    // Query reuses the same word0/mean0 free_text -> matching signature.
    const query = lesson("mine", TEN, [
      exStep("q1", "free_text", ["mine-c0"]),
      exStep("q2", "word_tiles", ["mine-c1"]),
    ]);
    const cmp = compareLessons(query, cand);
    expect(cmp.totalQueryExercises).toBe(2);
    expect(cmp.matchedExercises).toBe(1); // only the free_text on word0
    expect(cmp.exerciseOverlap).toBeCloseTo(0.5, 5);
  });

  it("excludes a candidate sharing the query's id", () => {
    const result = detectDuplicate(lesson("same", TEN), [lesson("same", TEN)]);
    expect(result.comparisons).toEqual([]);
    expect(result.tier).toBe("none");
  });
});

describe("markAsVariation", () => {
  it("tags a copy without mutating the original", () => {
    const original = lesson("mine", TEN);
    const variation = markAsVariation(original, "orig", "Mehr Übungen");
    expect(variation.variation_of).toBe("orig");
    expect(variation.variation_note).toBe("Mehr Übungen");
    expect(original.variation_of).toBeUndefined();
  });

  it("stores a null note when blank", () => {
    const variation = markAsVariation(lesson("mine", TEN), "orig", "   ");
    expect(variation.variation_note).toBeNull();
  });
});

describe("extractSupplement", () => {
  const original = lesson("orig", TEN, [
    exStep("e1", "free_text", ["orig-c0"]),
    exStep("e2", "matching", ["orig-c1", "orig-c2"]),
  ]);

  it("extracts only the exercises not already in the original", () => {
    const query = lesson("mine", TEN, [
      exStep("q1", "free_text", ["mine-c0"]), // same sig as e1 -> existing
      exStep("q2", "word_tiles", ["mine-c3"]), // new type -> new
      exStep("q3", "free_text", ["mine-c4"]), // new card -> new
    ]);
    const supplement = extractSupplement(query, original, "Zusätzliche Übungen");
    expect(supplement).not.toBeNull();
    expect(supplement!.steps).toHaveLength(2);
    expect(supplement!.steps.map((s) => s.exercise!.id)).toEqual(["q2", "q3"]);
    // Only the cards the new exercises reference travel with the supplement.
    expect(supplement!.cards.map((c) => c.id).sort()).toEqual([
      "mine-c3",
      "mine-c4",
    ]);
    expect(supplement!.variation_of).toBe("orig");
    expect(supplement!.variation_note).toBe("Zusätzliche Übungen");
    expect(supplement!.id).toBe("mine-supplement");
  });

  it("returns null when every exercise already exists in the original", () => {
    const query = lesson("mine", TEN, [
      exStep("q1", "free_text", ["mine-c0"]),
      exStep("q2", "matching", ["mine-c1", "mine-c2"]),
    ]);
    expect(extractSupplement(query, original)).toBeNull();
  });
});
