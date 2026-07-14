/**
 * Tests for the curated recommended-repos list (EXP-023 Phase C slice).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchRecommendedRepos,
  isRecommendedSource,
  isValidatedForSearch,
  parseRecommendedRepos,
  recommendedRef,
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

describe("parseRecommendedRepos — governance fields carry through", () => {
  it("preserves self / commit / trust_level / languages / validation", () => {
    const list = parseRecommendedRepos({
      repos: [
        {
          url: "https://github.com/astrapi69/adaptive-learner-content",
          branch: "main",
          title: "Official",
          trust_level: 3,
          self: true,
          languages: ["de-en"],
        },
        {
          url: "https://github.com/jane/content",
          branch: "main",
          commit: "a".repeat(40),
          trust_level: 1,
          languages: ["de-fr"],
          validation: { status: "validated", validated_at: "2026-07-09T00:00:00Z" },
        },
      ],
    });
    expect(list[0]).toMatchObject({ self: true, trust_level: 3 });
    expect(list[1]).toMatchObject({
      commit: "a".repeat(40),
      trust_level: 1,
      validation: { status: "validated" },
    });
  });
});

describe("isValidatedForSearch", () => {
  it("always includes the branch-tracked self entry", () => {
    expect(isValidatedForSearch({ url: "o/r", branch: "main", self: true })).toBe(true);
  });

  it("includes an external entry only when validation.status is validated", () => {
    const base = { url: "jane/x", branch: "main", commit: "a".repeat(40) };
    expect(
      isValidatedForSearch({
        ...base,
        validation: { status: "validated", validated_at: "2026-07-09T00:00:00Z" },
      }),
    ).toBe(true);
    expect(
      isValidatedForSearch({
        ...base,
        validation: { status: "pending", validated_at: "2026-07-09T00:00:00Z" },
      }),
    ).toBe(false);
    expect(
      isValidatedForSearch({
        ...base,
        validation: { status: "rejected", validated_at: "2026-07-09T00:00:00Z" },
      }),
    ).toBe(false);
    // Pre-governance entry (no validation, not self) is not searchable.
    expect(isValidatedForSearch(base)).toBe(false);
  });
});

describe("recommendedRef", () => {
  it("returns the branch for a self entry (branch-tracked)", () => {
    expect(recommendedRef({ url: "o/r", branch: "trunk", self: true })).toBe("trunk");
  });

  it("returns the pinned commit for an external entry", () => {
    const commit = "b".repeat(40);
    expect(recommendedRef({ url: "jane/x", branch: "main", commit })).toBe(commit);
  });

  it("falls back to the branch when an external entry lacks a commit", () => {
    expect(recommendedRef({ url: "jane/x", branch: "dev" })).toBe("dev");
  });
});
