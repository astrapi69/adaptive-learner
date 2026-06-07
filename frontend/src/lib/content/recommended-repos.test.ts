/**
 * Tests for the curated recommended-repos list (EXP-023 Phase C slice).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchRecommendedRepos,
  isRecommendedSource,
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

describe("fetchRecommendedRepos", () => {
  it("parses the repos array and defaults the branch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          repos: [
            { url: "jane/x", title: "X" },
            { url: "bob/y", branch: "dev" },
            { nope: true },
          ],
        }),
      })),
    );
    const list = await fetchRecommendedRepos();
    expect(list).toEqual([
      { url: "jane/x", title: "X", branch: "main" },
      { url: "bob/y", branch: "dev" },
    ]);
  });

  it("returns [] on a non-ok response / network error / bad JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    expect(await fetchRecommendedRepos()).toEqual([]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
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
