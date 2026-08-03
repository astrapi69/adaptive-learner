/** Tests for the EXP-034 / DIS-05 discovery filter + sort logic. */

import { describe, expect, it } from "vitest";

import {
  availableDomains,
  availableSources,
  availableSourceLanguages,
  availableTargetLanguages,
  availableLevels,
  discoverSetKey,
  EMPTY_FILTERS,
  hasReviewableSets,
  isSetDownloaded,
  matchesQuery,
  passesFilters,
  queryDiscoverSets,
  relaxationHints,
  sortDiscoverSets,
  sourceLanguageCounts,
  targetLanguageCounts,
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
    review_status: "authored",
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

  it("includes the UI-language names of the pair in the haystack (EXP-048 #2329)", () => {
    // A German-authored Spanish set: the visible name is "Spanisch A1".
    const set = makeSet({ name: "Spanisch A1", source_language: "de", target_language: "es" });
    const names = (code: string): string =>
      ({ de: "German", es: "Spanish" })[code] ?? code;
    // Without the resolver, the English SOURCE-language name "German" is not in
    // the haystack (the set's visible text is the German "Spanisch A1"). A
    // non-typo query is used on purpose: "spanish" ≈ "spanisch" now fuzzy-matches
    // (EXP-048 #2336), so it no longer proves the resolver added the name.
    expect(matchesQuery(set, normalizeSearchText("german"))).toBe(false);
    // With it, the UI-language names of BOTH sides become searchable.
    expect(matchesQuery(set, normalizeSearchText("spanish"), names)).toBe(true);
    expect(matchesQuery(set, normalizeSearchText("german"), names)).toBe(true);
  });
});

describe("matchesQuery — typo tolerance (EXP-048 #2336, Schwelle bewusst überschritten)", () => {
  it("matches a query token with one typo via bounded edit distance", () => {
    const set = makeSet({ name: "Spanisch A1" });
    // "spanissch" -> "spanisch" is a single insertion (edit distance 1).
    expect(matchesQuery(set, normalizeSearchText("spanissch"))).toBe(true);
  });

  it("does not match a query token with two or more typos", () => {
    const set = makeSet({ name: "Spanisch A1" });
    // "spanissssch" -> "spanisch" needs > 1 edit.
    expect(matchesQuery(set, normalizeSearchText("spanissssch"))).toBe(false);
  });

  it("requires an exact (substring) match for short query tokens (< 4 chars)", () => {
    const set = makeSet({ name: "Ruby", description: "", tags: [] });
    // "rob" is a 3-char typo of "rub"/"ruby": too short for fuzzy, must miss.
    expect(matchesQuery(set, normalizeSearchText("rob"))).toBe(false);
  });

  it("still requires EVERY query token to match (precision kept)", () => {
    const set = makeSet({ name: "Spanisch A1", description: "", tags: [] });
    // First token fuzzy-matches, second is unrelated: no overall match.
    expect(matchesQuery(set, normalizeSearchText("spanissch python"))).toBe(false);
  });

  it("fuzzy-matches against the resolved UI-language names too (EXP-048 #2329 + #2336)", () => {
    const set = makeSet({ name: "Spanisch A1", source_language: "de", target_language: "es" });
    const names = (code: string): string =>
      ({ de: "German", es: "Spanish" })[code] ?? code;
    // "spanicsh" -> "spanish" (delete one char, distance 1) via the resolved name.
    expect(matchesQuery(set, normalizeSearchText("spanicsh"), names)).toBe(true);
  });
});

describe("queryDiscoverSets — typo ranking (EXP-048 #2336, Schwelle bewusst überschritten)", () => {
  it("ranks exact query matches above typo-only matches under relevance", () => {
    const exact = makeSet({ id: "exact", name: "Spanisch Grundkurs" });
    // "Spanissch" only fuzzy-matches "spanisch" — no exact substring.
    const fuzzy = makeSet({ id: "fuzzy", name: "Spanissch Aufbau" });
    const sorted = queryDiscoverSets(
      [fuzzy, exact],
      { ...EMPTY_FILTERS, query: "spanisch" },
      "relevance",
    );
    expect(sorted.map((s) => s.id)).toEqual(["exact", "fuzzy"]);
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

  it("targetLanguage matches the target (learned) language only (EXP-048 #2322)", () => {
    const set = makeSet({ source_language: "de", target_language: "es" });
    expect(passesFilters(set, { ...EMPTY_FILTERS, targetLanguage: "es" })).toBe(true);
    // The source language must NOT satisfy the target-language facet.
    expect(passesFilters(set, { ...EMPTY_FILTERS, targetLanguage: "de" })).toBe(false);
    expect(passesFilters(set, { ...EMPTY_FILTERS, targetLanguage: "fr" })).toBe(false);
    // Empty = every target.
    expect(passesFilters(set, { ...EMPTY_FILTERS, targetLanguage: "" })).toBe(true);
  });

  it("source matches the set's repo_url exactly (EXP-048 #2330)", () => {
    const set = makeSet({ repo_url: "owner/repo" });
    expect(passesFilters(set, { ...EMPTY_FILTERS, source: "owner/repo" })).toBe(true);
    expect(passesFilters(set, { ...EMPTY_FILTERS, source: "other/repo" })).toBe(false);
    expect(passesFilters(set, { ...EMPTY_FILTERS, source: "" })).toBe(true);
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

  it("review status is an exact match; empty = all (EXP-048 #2321)", () => {
    const authored = makeSet({ review_status: "authored" });
    const generated = makeSet({ review_status: "generated" });
    const reviewed = makeSet({ review_status: "reviewed" });
    // "Ohne Maschinen-Sets" keeps only hand-written sets (generated + reviewed out).
    expect(passesFilters(authored, { ...EMPTY_FILTERS, reviewStatus: "authored" })).toBe(true);
    expect(passesFilters(generated, { ...EMPTY_FILTERS, reviewStatus: "authored" })).toBe(false);
    expect(passesFilters(reviewed, { ...EMPTY_FILTERS, reviewStatus: "authored" })).toBe(false);
    // "Nur durchgesehen" keeps only reviewed machine sets.
    expect(passesFilters(reviewed, { ...EMPTY_FILTERS, reviewStatus: "reviewed" })).toBe(true);
    expect(passesFilters(generated, { ...EMPTY_FILTERS, reviewStatus: "reviewed" })).toBe(false);
    // Empty = every review standing.
    expect(passesFilters(generated, { ...EMPTY_FILTERS, reviewStatus: "" })).toBe(true);
  });

  it("entry 'language' keeps language sets, 'knowledge' the inverse, '' both (#2331)", () => {
    const lang = makeSet({ id: "es", domain: "language", source_language: "de", target_language: "es" });
    const knowSameLang = makeSet({ id: "psy", domain: "psychology", source_language: "de", target_language: "de" });
    const knowDomainPair = makeSet({ id: "prog", domain: "programming", source_language: "de", target_language: "es" });
    // "Sprache lernen": only the clean language pair.
    expect(passesFilters(lang, { ...EMPTY_FILTERS, entry: "language" })).toBe(true);
    expect(passesFilters(knowSameLang, { ...EMPTY_FILTERS, entry: "language" })).toBe(false);
    expect(passesFilters(knowDomainPair, { ...EMPTY_FILTERS, entry: "language" })).toBe(false);
    // "Fachgebiet": the inverse (non-language domain OR same-language pair).
    expect(passesFilters(knowSameLang, { ...EMPTY_FILTERS, entry: "knowledge" })).toBe(true);
    expect(passesFilters(knowDomainPair, { ...EMPTY_FILTERS, entry: "knowledge" })).toBe(true);
    expect(passesFilters(lang, { ...EMPTY_FILTERS, entry: "knowledge" })).toBe(false);
    // "Alles": no entry filter.
    expect(passesFilters(lang, { ...EMPTY_FILTERS, entry: "" })).toBe(true);
    expect(passesFilters(knowSameLang, { ...EMPTY_FILTERS, entry: "" })).toBe(true);
  });

  it("surfaces a Mischfall: a language-domain set with source==target is not a clean language set (#2331)", () => {
    // The convention (domain=="language" <=> source!=target) is pinned by the
    // entry filter: a broken "language" set (source==target) is caught by the
    // knowledge rule, so it cannot hide silently in the language entry.
    const mischfall = makeSet({ domain: "language", source_language: "de", target_language: "de" });
    expect(passesFilters(mischfall, { ...EMPTY_FILTERS, entry: "language" })).toBe(false);
    expect(passesFilters(mischfall, { ...EMPTY_FILTERS, entry: "knowledge" })).toBe(true);
  });

  it("combines facets with AND", () => {
    const set = makeSet({ level: "a1", domain: "language", trust_level: 3, review_status: "reviewed" });
    const f: DiscoverFilters = { ...EMPTY_FILTERS, level: "a1", domain: "language", trust: "2", reviewStatus: "reviewed" };
    expect(passesFilters(set, f)).toBe(true);
    expect(passesFilters({ ...set, level: "a2" }, f)).toBe(false);
  });
});

describe("hasReviewableSets", () => {
  it("true only when the catalogue carries a generated or reviewed set", () => {
    expect(hasReviewableSets([makeSet({ review_status: "authored" })])).toBe(false);
    expect(hasReviewableSets([makeSet({ review_status: "generated" })])).toBe(true);
    expect(hasReviewableSets([makeSet({ review_status: "reviewed" })])).toBe(true);
    expect(hasReviewableSets([])).toBe(false);
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

  it("drops sets marked visibility: hidden at render time (#1707)", () => {
    const sets = [
      makeSet({ id: "de-fr-a1", visibility: "visible" }),
      makeSet({ id: "graded-quiz-demo-from-de", visibility: "hidden" }),
    ];
    const result = queryDiscoverSets(sets, EMPTY_FILTERS, "newest");
    expect(result.map((s) => s.id)).toEqual(["de-fr-a1"]);
  });

  it("keeps sets with no visibility field (absent ⇒ visible, #1707)", () => {
    const sets = [makeSet({ id: "de-fr-a1", visibility: undefined })];
    const result = queryDiscoverSets(sets, EMPTY_FILTERS, "newest");
    expect(result.map((s) => s.id)).toEqual(["de-fr-a1"]);
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
  it("target languages: distinct TARGET codes only, sorted (source ignored)", () => {
    expect(availableTargetLanguages(sets)).toEqual(["es"]);
    const mixed = [
      makeSet({ source_language: "de", target_language: "fr" }),
      makeSet({ source_language: "en", target_language: "es" }),
      makeSet({ source_language: "de", target_language: "es" }),
      makeSet({ source_language: "de", target_language: "" }),
    ];
    expect(availableTargetLanguages(mixed)).toEqual(["es", "fr"]);
  });
  it("counts sets per target language", () => {
    const counted = [
      makeSet({ target_language: "es" }),
      makeSet({ target_language: "es" }),
      makeSet({ target_language: "fr" }),
      makeSet({ target_language: "" }),
    ];
    expect(targetLanguageCounts(counted)).toEqual({ es: 2, fr: 1 });
  });
  it("levels sorted", () => {
    expect(availableLevels(sets)).toEqual(["a1", "b1"]);
  });
  it("domains sorted", () => {
    expect(availableDomains(sets)).toEqual(["ai", "language"]);
  });
  it("sources: distinct repo_url with name + count, sorted by name (#2330)", () => {
    const withSources = [
      makeSet({ repo_url: "o/a", repo_name: "Beta" }),
      makeSet({ repo_url: "o/a", repo_name: "Beta" }),
      makeSet({ repo_url: "o/b", repo_name: "Alpha" }),
    ];
    expect(availableSources(withSources)).toEqual([
      { url: "o/b", name: "Alpha", count: 1 },
      { url: "o/a", name: "Beta", count: 2 },
    ]);
  });
});

describe("relaxationHints (EXP-048 #2324)", () => {
  const sets = [
    makeSet({ id: "es-a1", target_language: "es", level: "a1", domain: "language" }),
    makeSet({ id: "es-a2", target_language: "es", level: "a2", domain: "language" }),
    makeSet({ id: "fr-a1", target_language: "fr", level: "a1", domain: "language" }),
  ];

  it("offers each active facet whose removal yields results, most first", () => {
    // Active target=ja (no match) + level=a1 -> zero results.
    const filters: DiscoverFilters = { ...EMPTY_FILTERS, targetLanguage: "ja", level: "a1" };
    expect(queryDiscoverSets(sets, filters, "relevance")).toHaveLength(0);
    // Clearing target keeps the two a1 sets; clearing level keeps 0 (still ja).
    expect(relaxationHints(sets, filters)).toEqual([{ facet: "targetLanguage", count: 2 }]);
  });

  it("sorts multiple viable relaxations by their yield (most first)", () => {
    const twoWay = [
      makeSet({ id: "es-1", target_language: "es", level: "a1" }),
      makeSet({ id: "es-2", target_language: "es", level: "a1" }),
      makeSet({ id: "fr-2", target_language: "fr", level: "a2" }),
    ];
    // target=es AND level=a2 -> 0 (es sets are a1, the a2 set is fr).
    const filters: DiscoverFilters = { ...EMPTY_FILTERS, targetLanguage: "es", level: "a2" };
    expect(queryDiscoverSets(twoWay, filters, "relevance")).toHaveLength(0);
    // Clear level -> target es keeps 2; clear target -> level a2 keeps 1.
    expect(relaxationHints(twoWay, filters)).toEqual([
      { facet: "level", count: 2 },
      { facet: "targetLanguage", count: 1 },
    ]);
  });

  it("returns nothing when no single relaxation helps", () => {
    const filters: DiscoverFilters = { ...EMPTY_FILTERS, targetLanguage: "ja", level: "b2" };
    expect(relaxationHints(sets, filters)).toEqual([]);
  });

  it("does not offer the source language (it owns a dedicated escape)", () => {
    const withSources = [
      makeSet({ id: "de", source_language: "de", target_language: "es" }),
      makeSet({ id: "en", source_language: "en", target_language: "es" }),
    ];
    // source=hi (no match) alone -> the source escape handles it, not a hint.
    const filters: DiscoverFilters = { ...EMPTY_FILTERS, sourceLanguage: "hi" };
    expect(relaxationHints(withSources, filters)).toEqual([]);
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
