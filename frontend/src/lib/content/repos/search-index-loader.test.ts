/**
 * Tests for the EXP-034 / DIS-04 search-index loader.
 *
 * Covers parse, cache hit (no network), cache miss (fetch + write), offline
 * fallback, error → empty array, stale-while-revalidate, and the parallel
 * concurrency cap (max 10).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchAllIndices,
  fetchSearchIndex,
  mapWithConcurrency,
  MAX_CONCURRENT_INDEX_FETCHES,
  parseSearchIndex,
  readSearchIndexCache,
  SEARCH_INDEX_TTL_MS,
  writeSearchIndexCache,
  type SearchableSet,
} from "./search-index-loader";
import { resolveRepoToken } from "./repo-token";
import { OFFICIAL_SOURCE } from "./source-identity";

function jsonRes(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

const SAMPLE_INDEX = {
  repo: "jane/content",
  generated: "2026-06-17T12:00:00Z",
  sets: [
    {
      id: "es-a1-from-de",
      name: "Spanisch A1",
      description: "Grundlagen Spanisch",
      source_language: "de",
      target_language: "es",
      level: "a1",
      domain: "language",
      lesson_count: 15,
      card_count: 450,
      tags: ["artikel", "alltag"],
      ai_validated: true,
      trust_level: 3,
      book: null,
      updated_at: "2026-06-10T00:00:00Z",
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseSearchIndex", () => {
  it("maps every field and enriches with repo source + name", () => {
    const sets = parseSearchIndex(SAMPLE_INDEX, "jane/content", "Jane's Content");
    expect(sets).toHaveLength(1);
    const set = sets[0];
    expect(set.id).toBe("es-a1-from-de");
    expect(set.name).toBe("Spanisch A1");
    expect(set.target_language).toBe("es");
    expect(set.lesson_count).toBe(15);
    expect(set.card_count).toBe(450);
    expect(set.tags).toEqual(["artikel", "alltag"]);
    expect(set.ai_validated).toBe(true);
    expect(set.trust_level).toBe(3);
    expect(set.book).toBeNull();
    expect(set.repo_url).toBe("jane/content");
    expect(set.repo_name).toBe("Jane's Content");
  });

  it("drops hidden dev/reference sets at parse time (kept out of the catalogue + cache)", () => {
    const sets = parseSearchIndex(
      {
        sets: [
          { id: "graded-quiz-demo-from-de", name: "Graded-Quiz Demo (Test)" },
          { id: "react-grundlagen-from-de", name: "React Grundlagen" },
        ],
      },
      "astrapi69/adaptive-learner-content-test",
      "Test repo",
    );
    expect(sets.map((s) => s.id)).toEqual(["react-grundlagen-from-de"]);
  });

  it("returns [] for a malformed payload (no sets array)", () => {
    expect(parseSearchIndex({}, "a/b", "a/b")).toEqual([]);
    expect(parseSearchIndex(null, "a/b", "a/b")).toEqual([]);
    expect(parseSearchIndex({ sets: "nope" }, "a/b", "a/b")).toEqual([]);
  });

  it("drops entries without a string id and applies defaults", () => {
    const sets = parseSearchIndex(
      { sets: [{ name: "no id" }, { id: "x" }] },
      "a/b",
      "a/b",
    );
    expect(sets).toHaveLength(1);
    expect(sets[0].id).toBe("x");
    expect(sets[0].name).toBe("x"); // falls back to id
    expect(sets[0].domain).toBe("language"); // default
    expect(sets[0].lesson_count).toBe(0);
    expect(sets[0].ai_validated).toBe(false);
    expect(sets[0].book).toBeNull();
  });

  it("parses a book companion when present", () => {
    const sets = parseSearchIndex(
      { sets: [{ id: "x", book: { title: "Clean Code", author: "Martin" } }] },
      "a/b",
      "a/b",
    );
    expect(sets[0].book).toEqual({ title: "Clean Code", author: "Martin" });
  });

  it("applies the registry trust floor as a minimum (governance ranking)", () => {
    // A repo the registry marks trust 2, whose set omits its own trust_level.
    const sets = parseSearchIndex({ sets: [{ id: "x" }] }, "a/b", "a/b", 2);
    expect(sets[0].trust_level).toBe(2);
    // A set that already ranks higher keeps its own trust.
    const higher = parseSearchIndex(
      { sets: [{ id: "y", trust_level: 3 }] },
      "a/b",
      "a/b",
      2,
    );
    expect(higher[0].trust_level).toBe(3);
  });
});

describe("fetchSearchIndex — pinned ref + trust floor", () => {
  it("reads the index at the pinned commit ref, not the branch", async () => {
    const commit = "a".repeat(40);
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, SAMPLE_INDEX));
    vi.stubGlobal("fetch", fetchMock);
    await fetchSearchIndex({ url: "jane/content", branch: "main", ref: commit });
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe(
      `https://raw.githubusercontent.com/jane/content/${commit}/search-index.json`,
    );
  });

  it("floors every fetched set's trust at the repo's registry trustLevel", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonRes(200, { sets: [{ id: "x" }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const sets = await fetchSearchIndex({ url: "jane/content", trustLevel: 2 });
    expect(sets[0].trust_level).toBe(2);
  });
});

describe("fetchSearchIndex — caching", () => {
  it("fetches, parses and writes the cache on a cache miss", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, SAMPLE_INDEX));
    vi.stubGlobal("fetch", fetchMock);

    const sets = await fetchSearchIndex({ url: "jane/content" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sets).toHaveLength(1);
    const cached = readSearchIndexCache("jane/content");
    expect(cached?.sets).toHaveLength(1);
    expect(cached?.stale).toBe(false);
  });

  it("returns the cached index WITHOUT a network request when fresh", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const sample = parseSearchIndex(SAMPLE_INDEX, "jane/content", "jane/content");
    writeSearchIndexCache("jane/content", sample);

    const sets = await fetchSearchIndex({ url: "jane/content" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sets).toHaveLength(1);
  });

  it("offline (rejected fetch) on a cache miss resolves to [] and does not cache", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const sets = await fetchSearchIndex({ url: "jane/content" });

    expect(sets).toEqual([]);
    expect(readSearchIndexCache("jane/content")).toBeNull();
  });

  it("offline falls back to a cached index when one exists", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    // Fresh cache → no network at all, returns cache.
    const sample = parseSearchIndex(SAMPLE_INDEX, "jane/content", "jane/content");
    writeSearchIndexCache("jane/content", sample);

    const sets = await fetchSearchIndex({ url: "jane/content" });

    expect(sets).toHaveLength(1);
  });

  it("a non-OK HTTP response resolves to [] (no crash, no cache)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(404, {}));
    vi.stubGlobal("fetch", fetchMock);

    const sets = await fetchSearchIndex({ url: "jane/content" });

    expect(sets).toEqual([]);
    expect(readSearchIndexCache("jane/content")).toBeNull();
  });

  it("an unresolvable URL resolves to [] with no network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const sets = await fetchSearchIndex({ url: "" });

    expect(sets).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("official source: shared PAT set → raw fetch, and cache-fallback intact (#1429)", async () => {
    localStorage.setItem("adaptive-learner.github_token", "ghp_shared");
    // The official/public source resolves NO token → raw host, no contents API.
    const token = resolveRepoToken(OFFICIAL_SOURCE);
    expect(token).toBe("");

    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, SAMPLE_INDEX));
    vi.stubGlobal("fetch", fetchMock);
    await fetchSearchIndex({ url: OFFICIAL_SOURCE, token });
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("raw.githubusercontent.com");
    expect(calledUrl).not.toContain("api.github.com");

    // A later network error falls back to the cached index (never blanks).
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    const sets = await fetchSearchIndex(
      { url: OFFICIAL_SOURCE, token },
      { forceRefresh: true },
    );
    expect(sets).toHaveLength(1);
  });
});

describe("fetchSearchIndex — stale-while-revalidate", () => {
  it("returns the stale cache immediately, refreshes in the background", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, SAMPLE_INDEX));
    vi.stubGlobal("fetch", fetchMock);

    const stale: SearchableSet[] = [
      {
        id: "old-set",
        name: "Old",
        description: "",
        source_language: "de",
        target_language: "fr",
        level: "a1",
        domain: "language",
        lesson_count: 1,
        card_count: 1,
        tags: [],
        ai_validated: false,
        trust_level: 0,
        book: null,
        updated_at: null,
        repo_url: "jane/content",
        repo_name: "jane/content",
      },
    ];
    const past = Date.now() - SEARCH_INDEX_TTL_MS - 1000;
    writeSearchIndexCache("jane/content", stale, past);

    const refreshed = new Promise<SearchableSet[]>((resolve) => {
      void fetchSearchIndex(
        { url: "jane/content" },
        { onRevalidated: (sets) => resolve(sets) },
      ).then((immediate) => {
        // Returned value is the STALE cache (immediate), not the network.
        expect(immediate).toHaveLength(1);
        expect(immediate[0].id).toBe("old-set");
      });
    });

    const fresh = await refreshed;
    expect(fresh[0].id).toBe("es-a1-from-de");
    // Background refresh updated the cache.
    const cached = readSearchIndexCache("jane/content");
    expect(cached?.sets[0].id).toBe("es-a1-from-de");
  });
});

describe("mapWithConcurrency", () => {
  it("never runs more than `limit` tasks at once and preserves order", async () => {
    let active = 0;
    let peak = 0;
    const fn = async (n: number): Promise<number> => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return n * 2;
    };
    const items = Array.from({ length: 25 }, (_, i) => i);

    const results = await mapWithConcurrency(items, 10, fn);

    expect(peak).toBeLessThanOrEqual(10);
    expect(peak).toBe(10); // saturates the pool with 25 items
    expect(results).toEqual(items.map((n) => n * 2));
  });

  it("handles an empty input", async () => {
    const results = await mapWithConcurrency<number, number>([], 10, async (n) => n);
    expect(results).toEqual([]);
  });
});

describe("fetchAllIndices", () => {
  it("flattens sets from every repo and caps concurrency at the default", async () => {
    expect(MAX_CONCURRENT_INDEX_FETCHES).toBe(10);
    let active = 0;
    let peak = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 2));
      active -= 1;
      return jsonRes(200, SAMPLE_INDEX);
    });
    vi.stubGlobal("fetch", fetchMock);

    const repos = Array.from({ length: 15 }, (_, i) => ({ url: `owner/repo-${i}` }));
    const sets = await fetchAllIndices(repos);

    expect(sets).toHaveLength(15); // one set per repo, flattened
    expect(peak).toBeLessThanOrEqual(10);
    expect(fetchMock).toHaveBeenCalledTimes(15);
  });

  it("a single failing repo contributes [] and never fails the batch", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("repo-bad")) throw new TypeError("Failed to fetch");
      return jsonRes(200, SAMPLE_INDEX);
    });
    vi.stubGlobal("fetch", fetchMock);

    const sets = await fetchAllIndices([
      { url: "owner/repo-good" },
      { url: "owner/repo-bad" },
    ]);

    expect(sets).toHaveLength(1);
    expect(sets[0].repo_url).toBe("owner/repo-good");
  });
});

// A live index that has gained a newly-published set (the first with a new
// source language, el) on top of the fresh-cached one.
const NEW_INDEX = {
  ...SAMPLE_INDEX,
  sets: [
    ...SAMPLE_INDEX.sets,
    {
      id: "fr-a1-from-el",
      name: "Γαλλικά A1",
      description: "Γαλλικά για ελληνόφωνους",
      source_language: "el",
      target_language: "fr",
      level: "a1",
      domain: "language",
      lesson_count: 8,
      card_count: 65,
      tags: [],
      ai_validated: false,
      trust_level: 3,
      book: null,
      updated_at: "2026-07-03T00:00:00Z",
    },
  ],
};

function seedFreshCacheWithoutNewSet(): void {
  writeSearchIndexCache(
    "jane/content",
    parseSearchIndex(SAMPLE_INDEX, "jane/content", "jane/content"),
  );
}

describe("fetchSearchIndex — forceRefresh (#1337)", () => {
  it("WITHOUT forceRefresh a fresh cache hides a newly-published set (the bug)", async () => {
    seedFreshCacheWithoutNewSet();
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, NEW_INDEX));
    vi.stubGlobal("fetch", fetchMock);

    const sets = await fetchSearchIndex({ url: "jane/content" });

    // Fresh cache → no network → the new el-fr set stays invisible.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sets.map((s) => s.id)).not.toContain("fr-a1-from-el");
  });

  it("forceRefresh ignores the fresh cache, refetches, and surfaces the new set", async () => {
    seedFreshCacheWithoutNewSet();
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, NEW_INDEX));
    vi.stubGlobal("fetch", fetchMock);

    const sets = await fetchSearchIndex({ url: "jane/content" }, { forceRefresh: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sets.map((s) => s.id)).toContain("fr-a1-from-el");
    // The refreshed catalogue is written back to the cache.
    expect(
      readSearchIndexCache("jane/content")?.sets.map((s) => s.id),
    ).toContain("fr-a1-from-el");
  });

  it("forceRefresh falls back to the cached sets on a network error (never blanks)", async () => {
    seedFreshCacheWithoutNewSet();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const sets = await fetchSearchIndex({ url: "jane/content" }, { forceRefresh: true });

    expect(sets.map((s) => s.id)).toEqual(["es-a1-from-de"]);
  });

  it("fetchAllIndices forwards forceRefresh so a synced repo shows new sets", async () => {
    seedFreshCacheWithoutNewSet();
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, NEW_INDEX));
    vi.stubGlobal("fetch", fetchMock);

    const sets = await fetchAllIndices([{ url: "jane/content" }], { forceRefresh: true });

    expect(sets.map((s) => s.id)).toContain("fr-a1-from-el");
  });
});
