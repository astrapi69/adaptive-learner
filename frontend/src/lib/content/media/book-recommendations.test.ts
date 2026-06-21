import { afterEach, describe, expect, it, vi } from "vitest";

import {
  booksForDomain,
  fetchBookRecommendations,
} from "./book-recommendations";

const YAML = `
domains:
  psychology:
    books:
      - title: "Psychologie"
        author: "Zimbardo et al."
        url: "https://www.amazon.de/dp/3868943234/"
        description: "Standardwerk."
        tags: ["lehrbuch"]
  programming:
    books:
      - title: "No URL book"
        author: "X"
      - title: "Bad URL book"
        author: "Y"
        url: "ftp://nope"
      - title: "Good"
        author: "Z"
        url: "https://example.com/x"
`;

function mockFetch(body: string, ok = true): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, text: async () => body }) as unknown as Response),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("fetchBookRecommendations", () => {
  it("parses books.yaml into a domain map, dropping invalid entries", async () => {
    mockFetch(YAML);
    const recs = await fetchBookRecommendations();
    expect(Object.keys(recs).sort()).toEqual(["programming", "psychology"]);
    expect(recs.psychology).toHaveLength(1);
    expect(recs.psychology[0].title).toBe("Psychologie");
    // The no-URL and non-http(s) entries are dropped; only "Good" survives.
    expect(recs.programming.map((b) => b.title)).toEqual(["Good"]);
  });

  it("returns {} on a failed fetch with no cache", async () => {
    mockFetch("", false);
    expect(await fetchBookRecommendations()).toEqual({});
  });

  it("falls back to the cached catalogue when the network fails", async () => {
    mockFetch(YAML);
    await fetchBookRecommendations(); // populates the localStorage cache
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const recs = await fetchBookRecommendations();
    expect(recs.psychology[0].title).toBe("Psychologie");
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
