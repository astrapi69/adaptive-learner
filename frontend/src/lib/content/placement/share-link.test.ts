/**
 * Tests for content-repo share links (EXP-023 Phase B).
 */

import { describe, expect, it } from "vitest";

import { buildAddRepoLink, buildSetShareLink, parseAddRepoQr } from "./share-link";
import { OFFICIAL_SOURCE } from "../repos/source-identity";

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

  it("appends an optional set slug (RED: set deep link, #1572)", () => {
    const link = buildAddRepoLink(
      { url: "jane/deck", branch: "main", set: "fr-a1" },
      "https://x.dev",
      "/app/",
    );
    const qs = new URL(link).searchParams;
    expect(qs.get("url")).toBe("jane/deck");
    expect(qs.get("branch")).toBe("main");
    expect(qs.get("set")).toBe("fr-a1");
  });

  it("omits the set param when no set is given (backwards compatible)", () => {
    const link = buildAddRepoLink({ url: "jane/deck", branch: "main" }, "https://x.dev", "/");
    expect(new URL(link).searchParams.has("set")).toBe(false);
  });
});

describe("buildSetShareLink (#1572)", () => {
  it("maps an official-source set onto the official repo url", () => {
    const link = buildSetShareLink(
      { source: OFFICIAL_SOURCE, branch: "main", id: "psychologie-a1" },
      "https://x.dev",
      "/app/",
    );
    const qs = new URL(link).searchParams;
    expect(qs.get("url")).toBe(OFFICIAL_SOURCE);
    expect(qs.get("set")).toBe("psychologie-a1");
  });

  it("maps a bundled-source set onto the official repo url", () => {
    const link = buildSetShareLink(
      { source: "bundled:adaptive-learner-content", branch: "main", id: "app-tutorial" },
      "https://x.dev",
      "/",
    );
    expect(new URL(link).searchParams.get("url")).toBe(OFFICIAL_SOURCE);
  });

  it("uses the user repo source verbatim for a non-official set", () => {
    const link = buildSetShareLink(
      { source: "coach/deck", branch: "dev", id: "coach/lesson-1" },
      "https://x.dev",
      "/",
    );
    const qs = new URL(link).searchParams;
    expect(qs.get("url")).toBe("coach/deck");
    expect(qs.get("branch")).toBe("dev");
    expect(qs.get("set")).toBe("coach/lesson-1");
  });

  it("NEVER leaks a token — only url, branch and set params (security)", () => {
    const link = buildSetShareLink(
      { source: "coach/private-deck", branch: "main", id: "secret-set" },
      "https://x.dev",
      "/",
    );
    expect([...new URL(link).searchParams.keys()].sort()).toEqual(["branch", "set", "url"]);
    expect(link.toLowerCase()).not.toContain("token");
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

  it("carries the set slug through when present (#1572)", () => {
    const link = buildSetShareLink(
      { source: "coach/deck", branch: "dev", id: "coach/lesson-1" },
      "https://x.dev",
      "/app/",
    );
    expect(parseAddRepoQr(link)).toEqual({
      url: "coach/deck",
      branch: "dev",
      set: "coach/lesson-1",
    });
  });
});
