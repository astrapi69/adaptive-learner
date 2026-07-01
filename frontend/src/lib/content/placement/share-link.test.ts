/**
 * Tests for content-repo share links (EXP-023 Phase B).
 */

import { describe, expect, it } from "vitest";

import { buildAddRepoLink, parseAddRepoQr } from "./share-link";

describe("buildAddRepoLink", () => {
  it("builds an absolute add-repo deep link with url + branch", () => {
    const link = buildAddRepoLink(
      { url: "jane/deck", branch: "main" },
      "https://astrapi69.github.io",
      "/adaptive-learner/",
    );
    expect(link).toBe(
      "https://astrapi69.github.io/adaptive-learner/add-repo?url=jane%2Fdeck&branch=main",
    );
  });

  it("normalises a base path without a trailing slash + defaults branch", () => {
    const link = buildAddRepoLink(
      { url: "jane/deck", branch: "" },
      "https://x.dev",
      "/app",
    );
    expect(link).toBe("https://x.dev/app/add-repo?url=jane%2Fdeck&branch=main");
  });

  it("carries no token (only url + branch params)", () => {
    const link = buildAddRepoLink(
      { url: "jane/deck", branch: "dev" },
      "https://x.dev",
      "/",
    );
    const qs = new URL(link).searchParams;
    expect([...qs.keys()].sort()).toEqual(["branch", "url"]);
  });
});

describe("parseAddRepoQr (#1317)", () => {
  it("round-trips an absolute add-repo deep link built by buildAddRepoLink", () => {
    const link = buildAddRepoLink(
      { url: "jane/deck", branch: "dev" },
      "https://astrapi69.github.io",
      "/adaptive-learner/",
    );
    expect(parseAddRepoQr(link)).toEqual({ url: "jane/deck", branch: "dev" });
  });

  it("defaults the branch to main when the deep link omits it", () => {
    expect(
      parseAddRepoQr("https://x.dev/app/add-repo?url=jane%2Fdeck"),
    ).toEqual({ url: "jane/deck", branch: "main" });
  });

  it("parses a bare add-repo fragment", () => {
    expect(parseAddRepoQr("add-repo?url=owner%2Frepo&branch=feat")).toEqual({
      url: "owner/repo",
      branch: "feat",
    });
  });

  it("accepts a plain GitHub repo URL (branch defaults to main)", () => {
    expect(parseAddRepoQr("https://github.com/owner/repo")).toEqual({
      url: "https://github.com/owner/repo",
      branch: "main",
    });
  });

  it("accepts a bare owner/repo slug", () => {
    expect(parseAddRepoQr("owner/repo")).toEqual({
      url: "owner/repo",
      branch: "main",
    });
  });

  it("returns null for a non-repo payload", () => {
    expect(parseAddRepoQr("just some scanned text")).toBeNull();
    expect(parseAddRepoQr("")).toBeNull();
    expect(parseAddRepoQr("https://example.com/hello")).toBeNull();
  });
});
