/** Tests for the EXP-034 / DIS-05 discovery filter + sort logic. */

import { describe, expect, it } from "vitest";

import {
  availableDomains,
  availableSourceLanguages,
  availableLevels,
  discoverSetKey,
  EMPTY_FILTERS,
  isSetDownloaded,
  matchesQuery,
  passesFilters,
  queryDiscoverSets,
  sortDiscoverSets,
  sourceLanguageCounts,
  type DiscoverFilters,
} from "./discover-index";
import { normalizeSearchText } from "../browse/content-search";
import type { SearchableSet } from "./search-index-loader";

function makeSet(over: Partial<SearchableSet>): SearchableSet {
  return {
    id: "id",
    name: "Name",
    description: "",
    source_language: "de",
    target_language: "es",
    level: "a1",
    domain: "language",
    lesson_count: 10,
    card_count: 100,
    tags: [],
    ai_validated: false,
    trust_level: 0,
    book: null,
    updated_at: null,
    repo_url: "owner/repo",
    repo_name: "owner/repo",
    ...over,
  };
}

describe("matchesQuery", () => {
  it("matches name, accent- and digraph-insensitively", () => {
    const set = makeSet({ name: "Grüße auf Spanisch" });
    expect(matchesQuery(set, normalizeSearchText("gruesse"))).toBe(true);
    expect(matchesQuery(set, normalizeSearchText("spanisch"))).toBe(true);
    expect(matchesQuery(set, normalizeSearchText("python"))).toBe(false);
  });

  it("matches tags and description", () => {
    const set = makeSet({ description: "Künstliche Intelligenz", tags: ["llm"] });
    expect(matchesQuery(set, normalizeSearchText("intelligenz"))).toBe(true);
    expect(matchesQuery(set, normalizeSearchText("llm"))).toBe(true);
  });

  it("an empty query matches everything", () => {
    expect(matchesQuery(makeSet({}), "")).toBe(true);
  });
});

describe("passesFilters", () => {
  it("sourceLanguage matches the source (instruction) language only", () => {
    const set = makeSet({ source_language: "de", target_language: "es" });
    expect(passesFilters(set, { ...EMPTY_FILTERS, sourceLanguage: "de" })).toBe(true);
    // The target language must NOT satisfy the source-language facet.
    expect(passesFilters(set, { ...EMPTY_FILTERS, sourceLanguage: "es" })).toBe(false);
    expect(passesFilters(set, { ...EMPTY_FILTERS, sourceLanguage: "fr" })).toBe(false);
    // Empty = all languages.
    expect(passesFilters(set, { ...EMPTY_FILTERS, sourceLanguage: "" })).toBe(true);
  });

  it("level + domain are exact", () => {
    const set = makeSet({ level: "b1", domain: "ai" });
    expect(passesFilters(set, { ...EMPTY_FILTERS, level: "b1" })).toBe(true);
    expect(passesFilters(set, { ...EMPTY_FILTERS, level: "a1" })).toBe(false);
    expect(passesFilters(set, { ...EMPTY_FILTERS, domain: "ai" })).toBe(true);
    expect(passesFilters(set, { ...EMPTY_FILTERS, domain: "language" })).toBe(false);
  });

  it("trust is a minimum level", () => {
    expect(passesFilters(makeSet({ trust_level: 3 }), { ...EMPTY_FILTERS, trust: "1" })).toBe(true);
    expect(passesFilters(makeSet({ trust_level: 1 }), { ...EMPTY_FILTERS, trust: "3" })).toBe(false);
    expect(passesFilters(makeSet({ trust_level: 2 }), { ...EMPTY_FILTERS, trust: "2" })).toBe(true);
  });

  it("ai-checked yes/no", () => {
    expect(passesFilters(makeSet({ ai_validated: true }), { ...EMPTY_FILTERS, aiChecked: "yes" })).toBe(true);
    expect(passesFilters(makeSet({ ai_validated: false }), { ...EMPTY_FILTERS, aiChecked: "yes" })).toBe(false);
    expect(passesFilters(makeSet({ ai_validated: false }), { ...EMPTY_FILTERS, aiChecked: "no" })).toBe(true);
  });

  it("combines facets with AND", () => {
    const set = makeSet({ level: "a1", domain: "language", trust_level: 3, ai_validated: true });
    const f: DiscoverFilters = { ...EMPTY_FILTERS, level: "a1", domain: "language", trust: "2", aiChecked: "yes" };
    expect(passesFilters(set, f)).toBe(true);
    expect(passesFilters({ ...set, level: "a2" }, f)).toBe(false);
  });
});

describe("sortDiscoverSets", () => {
  it("newest: updated_at desc, nulls last", () => {
    const a = makeSet({ id: "a", name: "A", updated_at: "2026-01-01T00:00:00Z" });
    const b = makeSet({ id: "b", name: "B", updated_at: "2026-06-01T00:00:00Z" });
    const c = makeSet({ id: "c", name: "C", updated_at: null });
    const sorted = sortDiscoverSets([a, b, c], "newest", "");
    expect(sorted.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("lessons: lesson_count desc", () => {
    const a = makeSet({ id: "a", lesson_count: 5 });
    const b = makeSet({ id: "b", lesson_count: 20 });
    expect(sortDiscoverSets([a, b], "lessons", "").map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("relevance with a query ranks name match above description", () => {
    const nameHit = makeSet({ id: "n", name: "Spanisch A1", description: "x" });
    const descHit = makeSet({ id: "d", name: "Kurs", description: "Spanisch lernen" });
    const sorted = sortDiscoverSets([descHit, nameHit], "relevance", "spanisch");
    expect(sorted[0].id).toBe("n");
  });

  it("relevance without a query falls back to trust then name", () => {
    const lowTrust = makeSet({ id: "l", name: "A", trust_level: 0 });
    const highTrust = makeSet({ id: "h", name: "B", trust_level: 3 });
    expect(sortDiscoverSets([lowTrust, highTrust], "relevance", "").map((s) => s.id)).toEqual(["h", "l"]);
  });

  it("does not mutate the input array", () => {
    const input = [makeSet({ id: "a", lesson_count: 1 }), makeSet({ id: "b", lesson_count: 2 })];
    const snapshot = input.map((s) => s.id);
    sortDiscoverSets(input, "lessons", "");
    expect(input.map((s) => s.id)).toEqual(snapshot);
  });
});

describe("queryDiscoverSets", () => {
  it("filters then sorts", () => {
    const sets = [
      makeSet({ id: "es", name: "Spanisch", target_language: "es", lesson_count: 5 }),
      makeSet({ id: "fr", name: "Französisch", target_language: "fr", lesson_count: 20 }),
      makeSet({ id: "py", name: "Python", domain: "programming", lesson_count: 9 }),
    ];
    const result = queryDiscoverSets(
      sets,
      { ...EMPTY_FILTERS, domain: "language" },
      "lessons",
    );
    expect(result.map((s) => s.id)).toEqual(["fr", "es"]);
  });

  it("drops hidden dev/reference sets even from a stale cache", () => {
    // A pre-blocklist cache could still carry the graded-quiz-demo entry; the
    // display filter must exclude it regardless of the parse-time drop.
    const sets = [
      makeSet({ id: "es", name: "Spanisch" }),
      makeSet({
        id: "graded-quiz-demo-from-de",
        name: "Graded-Quiz Demo (Test)",
        repo_url: "astrapi69/adaptive-learner-content-test",
      }),
    ];
    const result = queryDiscoverSets(sets, EMPTY_FILTERS, "relevance");
    expect(result.map((s) => s.id)).toEqual(["es"]);
  });
});

describe("available* option helpers", () => {
  const sets = [
    makeSet({ source_language: "de", target_language: "es", level: "a1", domain: "language" }),
    makeSet({ source_language: "en", target_language: "es", level: "b1", domain: "ai" }),
  ];
  it("source languages: distinct SOURCE codes only, sorted (target ignored)", () => {
    expect(availableSourceLanguages(sets)).toEqual(["de", "en"]);
  });
  it("ignores sets with an empty source language", () => {
    expect(availableSourceLanguages([...sets, makeSet({ source_language: "" })])).toEqual([
      "de",
      "en",
    ]);
  });
  it("counts sets per source language", () => {
    const counted = [
      makeSet({ source_language: "de" }),
      makeSet({ source_language: "de" }),
      makeSet({ source_language: "el" }),
      makeSet({ source_language: "" }),
    ];
    expect(sourceLanguageCounts(counted)).toEqual({ de: 2, el: 1 });
  });
  it("levels sorted", () => {
    expect(availableLevels(sets)).toEqual(["a1", "b1"]);
  });
  it("domains sorted", () => {
    expect(availableDomains(sets)).toEqual(["ai", "language"]);
  });
});

describe("discoverSetKey", () => {
  it("combines repo source and set id", () => {
    expect(discoverSetKey({ repo_url: "owner/repo", id: "es-a1" })).toBe("owner/repo::es-a1");
  });
});

describe("isSetDownloaded", () => {
  it("matches a cached set by source + id", () => {
    const set = makeSet({ id: "es-a1", repo_url: "owner/repo" });
    expect(
      isSetDownloaded(set, [{ source: "owner/repo", id: "es-a1", cached_version: "1.0.0" }]),
    ).toBe(true);
  });

  it("does not match an uncached (cached_version null) row", () => {
    const set = makeSet({ id: "es-a1", repo_url: "owner/repo" });
    expect(
      isSetDownloaded(set, [{ source: "owner/repo", id: "es-a1", cached_version: null }]),
    ).toBe(false);
  });

  it("matches official content cached under a bundled source", () => {
    const set = makeSet({ id: "fr-a1", repo_url: "astrapi69/adaptive-learner-content" });
    expect(
      isSetDownloaded(set, [
        { source: "bundled:adaptive-learner-content", id: "fr-a1", cached_version: "1.0.0" },
      ]),
    ).toBe(true);
  });

  it("does not cross-match different user repos with the same id", () => {
    const set = makeSet({ id: "x", repo_url: "alice/repo" });
    expect(
      isSetDownloaded(set, [{ source: "bob/repo", id: "x", cached_version: "1.0.0" }]),
    ).toBe(false);
  });
});
