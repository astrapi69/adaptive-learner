/**
 * Tests for the curated recommended-repos list (EXP-023 Phase C slice).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchRecommendedRepos,
  isRecommendedSource,
  parseRecommendedRepos,
  recommendedSource,
} from "./recommended-repos";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("recommendedSource", () => {
  it("normalises url / shorthand to owner/repo", () => {
    expect(recommendedSource({ url: "jane/x", branch: "main" })).toBe("jane/x");
    expect(
      recommendedSource({ url: "https://github.com/jane/x", branch: "main" }),
    ).toBe("jane/x");
    expect(recommendedSource({ url: "garbage", branch: "main" })).toBeNull();
  });
});

describe("parseRecommendedRepos", () => {
  it("parses the repos array and defaults the branch", () => {
    const list = parseRecommendedRepos({
      repos: [
        { url: "jane/x", title: "X" },
        { url: "bob/y", branch: "dev" },
        { nope: true },
      ],
    });
    expect(list).toEqual([
      { url: "jane/x", title: "X", branch: "main" },
      { url: "bob/y", branch: "dev" },
    ]);
  });

  it("returns [] for a missing / non-array / malformed payload", () => {
    expect(parseRecommendedRepos(null)).toEqual([]);
    expect(parseRecommendedRepos({})).toEqual([]);
    expect(parseRecommendedRepos({ repos: "nope" })).toEqual([]);
  });
});

describe("fetchRecommendedRepos", () => {
  it("fetches + parses the published catalogue (#547)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ repos: [{ url: "jane/x", title: "X" }] }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    expect(await fetchRecommendedRepos()).toEqual([
      { url: "jane/x", title: "X", branch: "main" },
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("resolves to [] on a network/HTTP failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchRecommendedRepos()).toEqual([]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchRecommendedRepos()).toEqual([]);
  });
});

describe("isRecommendedSource", () => {
  it("matches by normalised source", () => {
    const list = [{ url: "https://github.com/jane/x", branch: "main" }];
    expect(isRecommendedSource("jane/x", list)).toBe(true);
    expect(isRecommendedSource("bob/y", list)).toBe(false);
  });
});
