/**
 * book-recommendations (#141, federated per #1712).
 *
 * ``books.yaml`` was deliberately removed from the official content repo
 * (adaptive-learner-content#149 — domain federation); fetching it there was
 * a guaranteed console 404 on every /content mount. The catalogue is now
 * sourced from the registry (``recommended-repos.json``): only entries that
 * declare ``books: true`` are requested (at their pinned ref), so a repo
 * without a ``books.yaml`` is never asked for one.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  booksForDomain,
  fetchBookRecommendations,
} from "./book-recommendations";
import type { RecommendedRepo } from "../repos/recommended-repos";

const fetchRecommendedReposMock = vi.fn(async (): Promise<RecommendedRepo[]> => []);

vi.mock("../repos/recommended-repos", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../repos/recommended-repos")>();
  return {
    ...actual,
    fetchRecommendedRepos: () => fetchRecommendedReposMock(),
  };
});

const AI_YAML = `
domains:
  ai:
    books:
      - title: "KI für Einsteiger"
        author: "Asterios Raptis"
        url: "https://www.amazon.de/dp/B0F43H6T2M/"
`;

const PSY_YAML = `
domains:
  psychology:
    books:
      - title: "Psychologie"
        author: "Zimbardo et al."
        url: "https://www.amazon.de/dp/3868943234/"
        description: "Standardwerk."
        tags: ["lehrbuch"]
      - title: "No URL book"
        author: "X"
      - title: "Bad URL book"
        author: "Y"
        url: "ftp://nope"
`;

function repo(over: Partial<RecommendedRepo> = {}): RecommendedRepo {
  return {
    url: "https://github.com/astrapi69/alc-psychology",
    branch: "main",
    commit: "abc123",
    ...over,
  };
}

/** URL-aware fetch stub; records every requested URL. */
function mockFetch(bodies: Record<string, string>): string[] {
  const requested: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(String(url));
      const body = bodies[String(url)];
      return {
        ok: body !== undefined,
        text: async () => body ?? "",
      } as unknown as Response;
    }),
  );
  return requested;
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchRecommendedReposMock.mockReset();
  fetchRecommendedReposMock.mockResolvedValue([]);
  localStorage.clear();
});

describe("fetchBookRecommendations (federated, #1712)", () => {
  it("never requests books.yaml from the official repo root (removed in content#149)", async () => {
    fetchRecommendedReposMock.mockResolvedValue([
      repo({ url: "https://github.com/astrapi69/adaptive-learner-content", self: true }),
    ]);
    const requested = mockFetch({});
    await fetchBookRecommendations();
    expect(
      requested.filter((u) => u.includes("adaptive-learner-content/main/books.yaml")),
    ).toEqual([]);
  });

  it("requests books.yaml ONLY from registry entries flagged books: true, at the pinned ref", async () => {
    fetchRecommendedReposMock.mockResolvedValue([
      repo({ url: "https://github.com/astrapi69/alc-ai", commit: "pin1", books: true }),
      repo({ url: "https://github.com/astrapi69/alc-programming", commit: "pin2" }),
    ]);
    const requested = mockFetch({
      "https://raw.githubusercontent.com/astrapi69/alc-ai/pin1/books.yaml": AI_YAML,
    });
    const recs = await fetchBookRecommendations();
    expect(requested).toEqual([
      "https://raw.githubusercontent.com/astrapi69/alc-ai/pin1/books.yaml",
    ]);
    expect(Object.keys(recs)).toEqual(["ai"]);
    expect(recs.ai[0].title).toBe("KI für Einsteiger");
  });

  it("merges the domain sections of several flagged repos + drops invalid entries", async () => {
    fetchRecommendedReposMock.mockResolvedValue([
      repo({ url: "https://github.com/astrapi69/alc-ai", commit: "pin1", books: true }),
      repo({ url: "https://github.com/astrapi69/alc-psychology", commit: "pin2", books: true }),
    ]);
    mockFetch({
      "https://raw.githubusercontent.com/astrapi69/alc-ai/pin1/books.yaml": AI_YAML,
      "https://raw.githubusercontent.com/astrapi69/alc-psychology/pin2/books.yaml": PSY_YAML,
    });
    const recs = await fetchBookRecommendations();
    expect(Object.keys(recs).sort()).toEqual(["ai", "psychology"]);
    // The no-URL and non-http(s) entries are dropped.
    expect(recs.psychology.map((b) => b.title)).toEqual(["Psychologie"]);
  });

  it("makes NO request when no registry entry is flagged (empty result, no 404 noise)", async () => {
    fetchRecommendedReposMock.mockResolvedValue([repo(), repo()]);
    const requested = mockFetch({});
    expect(await fetchBookRecommendations()).toEqual({});
    expect(requested).toEqual([]);
  });

  it("falls back to the cached catalogue when every flagged fetch fails", async () => {
    const flagged = [
      repo({ url: "https://github.com/astrapi69/alc-ai", commit: "pin1", books: true }),
    ];
    fetchRecommendedReposMock.mockResolvedValue(flagged);
    mockFetch({
      "https://raw.githubusercontent.com/astrapi69/alc-ai/pin1/books.yaml": AI_YAML,
    });
    await fetchBookRecommendations(); // populates the localStorage cache
    mockFetch({}); // network gone: every fetch answers not-ok
    const recs = await fetchBookRecommendations();
    expect(recs.ai[0].title).toBe("KI für Einsteiger");
  });

  it("falls back to the cache when the registry itself is unreachable (empty)", async () => {
    const flagged = [
      repo({ url: "https://github.com/astrapi69/alc-ai", commit: "pin1", books: true }),
    ];
    fetchRecommendedReposMock.mockResolvedValue(flagged);
    mockFetch({
      "https://raw.githubusercontent.com/astrapi69/alc-ai/pin1/books.yaml": AI_YAML,
    });
    await fetchBookRecommendations();
    fetchRecommendedReposMock.mockResolvedValue([]); // offline registry -> []
    const requested = mockFetch({});
    const recs = await fetchBookRecommendations();
    expect(requested).toEqual([]);
    expect(recs.ai[0].title).toBe("KI für Einsteiger");
  });
});

describe("booksForDomain", () => {
  it("returns the domain's books or an empty list", () => {
    const recs = {
      psychology: [{ title: "P", author: "A", url: "https://x" }],
    };
    expect(booksForDomain(recs, "psychology")).toHaveLength(1);
    expect(booksForDomain(recs, "programming")).toEqual([]);
    expect(booksForDomain(recs, null)).toEqual([]);
  });
});
