/**
 * Tests for resolving a shared set id against the federated registry (#3819).
 *
 * The fixtures follow the producers' real shapes: repos as
 * ``collectDiscoveryRepos`` returns them (official first, registry entries
 * with a full GitHub URL and a pinned ``ref``), sets as ``parseSearchIndex``
 * returns them (``repo_url`` is the ``owner/repo`` source).
 */

import { describe, expect, it, vi } from "vitest";

import { findSetInRegistry } from "./registry-set-lookup";
import type { SearchableSet, SearchIndexRepo } from "./search-index-loader";

const OFFICIAL: SearchIndexRepo = {
  url: "astrapi69/adaptive-learner-content",
  branch: "main",
  name: "astrapi69/adaptive-learner-content",
  trustLevel: 3,
};
const AI: SearchIndexRepo = {
  url: "https://github.com/astrapi69/alc-ai",
  branch: "main",
  ref: "a".repeat(40),
  name: "KI",
  token: "",
  trustLevel: 3,
};
const BOOKS: SearchIndexRepo = {
  url: "https://github.com/astrapi69/alc-books",
  branch: "release",
  ref: "b".repeat(40),
  name: "Bücher",
  token: "",
  trustLevel: 2,
};

function indexedSet(id: string, repo: string): SearchableSet {
  return {
    id,
    name: `Set ${id}`,
    description: "",
    source_language: "de",
    target_language: "de",
    level: "A1",
    domain: "ai",
    lesson_count: 4,
    card_count: 0,
    tags: [],
    ai_validated: false,
    trust_level: 3,
    book: null,
    updated_at: null,
    repo_url: repo,
    repo_name: repo,
    review_status: "authored",
  };
}

function deps(indices: Record<string, SearchableSet[]>, online = true) {
  const fetchIndex = vi.fn(async (repo: SearchIndexRepo) => indices[repo.url] ?? []);
  return {
    collectRepos: async () => [OFFICIAL, AI, BOOKS],
    fetchIndex,
    isOnline: () => online,
  };
}

describe("findSetInRegistry", () => {
  it("finds a set in a registry repo and names the repo to connect", async () => {
    const set = indexedSet("ki-einsteiger-from-de", "astrapi69/alc-ai");
    const result = await findSetInRegistry(
      "ki-einsteiger-from-de",
      deps({ [AI.url]: [indexedSet("other", "astrapi69/alc-ai"), set] }),
    );
    expect(result).toEqual({
      status: "found",
      set,
      repo: { url: AI.url, branch: "main" },
    });
  });

  it("carries the registry branch, not the pinned commit, as the branch to connect", async () => {
    const result = await findSetInRegistry(
      "buch-1",
      deps({ [BOOKS.url]: [indexedSet("buch-1", "astrapi69/alc-books")] }),
    );
    expect(result).toMatchObject({ status: "found", repo: { branch: "release" } });
  });

  it("does not read the official repo, whose sets the app lists already", async () => {
    const d = deps({ [OFFICIAL.url]: [indexedSet("fr-a1", OFFICIAL.url)] });
    const result = await findSetInRegistry("fr-a1", d);
    expect(result).toEqual({ status: "absent" });
    expect(d.fetchIndex.mock.calls.map(([repo]) => repo.url)).toEqual([AI.url, BOOKS.url]);
  });

  it("takes the first repo in registry order when two repos carry the id", async () => {
    const result = await findSetInRegistry(
      "dup",
      deps({
        [AI.url]: [indexedSet("dup", "astrapi69/alc-ai")],
        [BOOKS.url]: [indexedSet("dup", "astrapi69/alc-books")],
      }),
    );
    expect(result).toMatchObject({ status: "found", repo: { url: AI.url } });
  });

  it.each([
    ["an unknown id", "nope"],
    ["an empty id", ""],
  ])("reports absent for %s while online", async (_label, setId) => {
    const result = await findSetInRegistry(
      setId,
      deps({ [AI.url]: [indexedSet("ki-einsteiger-from-de", "astrapi69/alc-ai")] }),
    );
    expect(result).toEqual({ status: "absent" });
  });

  it("reports unreachable when nothing matched and the browser is offline", async () => {
    const result = await findSetInRegistry("ki-einsteiger-from-de", deps({}, false));
    expect(result).toEqual({ status: "unreachable" });
  });

  it("still returns a set from a cached index while offline", async () => {
    const result = await findSetInRegistry(
      "ki-einsteiger-from-de",
      deps({ [AI.url]: [indexedSet("ki-einsteiger-from-de", "astrapi69/alc-ai")] }, false),
    );
    expect(result).toMatchObject({ status: "found" });
  });

  it("reports unreachable when the repo list itself cannot be read offline", async () => {
    const result = await findSetInRegistry("x", {
      collectRepos: async () => {
        throw new Error("network");
      },
      fetchIndex: async () => [],
      isOnline: () => false,
    });
    expect(result).toEqual({ status: "unreachable" });
  });
});
