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
  it("returns [] WITHOUT a network request while the catalogue is unpublished", async () => {
    // The catalogue ships later with AUTH-03 (EXP-025); until then the
    // fetch is skipped so the not-yet-existing file never logs a 404.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await fetchRecommendedRepos()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("isRecommendedSource", () => {
  it("matches by normalised source", () => {
    const list = [{ url: "https://github.com/jane/x", branch: "main" }];
    expect(isRecommendedSource("jane/x", list)).toBe(true);
    expect(isRecommendedSource("bob/y", list)).toBe(false);
  });
});
