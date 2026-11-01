/**
 * Tests for content-repo share links (EXP-023 Phase B).
 */

import { describe, expect, it } from "vitest";

import { buildAddRepoLink, buildSetLink, buildSetShareLink, parseAddRepoQr } from "./share-link";
import { OFFICIAL_SOURCE } from "../repos/source-identity";

describe("buildAddRepoLink", () => {
  it("builds an absolute add-repo deep link with a readable repo param (#3819)", () => {
    const link = buildAddRepoLink(
      { url: "jane/deck", branch: "dev" },
      "https://astrapi69.github.io",
      "/adaptive-learner/",
    );
    expect(link).toBe("https://astrapi69.github.io/adaptive-learner/add-repo?repo=jane/deck&branch=dev");
  });

  it.each([
    ["main", "main"],
    ["an empty branch", ""],
  ])("leaves out the branch when it is %s", (_label, branch) => {
    const link = buildAddRepoLink({ url: "jane/deck", branch }, "https://x.dev", "/app");
    expect(link).toBe("https://x.dev/app/add-repo?repo=jane/deck");
  });

  it("carries no token (only repo + branch params)", () => {
    const link = buildAddRepoLink({ url: "jane/deck", branch: "dev" }, "https://x.dev", "/");
    const qs = new URL(link).searchParams;
    expect([...qs.keys()].sort()).toEqual(["branch", "repo"]);
  });

  it("appends an optional set slug (#1572)", () => {
    const link = buildAddRepoLink(
      { url: "jane/deck", branch: "main", set: "fr-a1" },
      "https://x.dev",
      "/app/",
    );
    expect(link).toBe("https://x.dev/app/add-repo?repo=jane/deck&set=fr-a1");
  });

  it("still encodes what a query value cannot carry", () => {
    const link = buildAddRepoLink(
      { url: "jane/deck", branch: "feat/a&b", set: "x y" },
      "https://x.dev",
      "/",
    );
    const qs = new URL(link).searchParams;
    expect(qs.get("branch")).toBe("feat/a&b");
    expect(qs.get("set")).toBe("x y");
  });
});

describe("buildSetLink (#3819)", () => {
  it("builds the short set link", () => {
    expect(buildSetLink("ki-einsteiger-from-de", "https://astrapi69.github.io", "/adaptive-learner/")).toBe(
      "https://astrapi69.github.io/adaptive-learner/content/set/ki-einsteiger-from-de",
    );
  });

  it("encodes an id that is no plain path segment", () => {
    expect(buildSetLink("coach/lesson 1", "https://x.dev", "/app")).toBe(
      "https://x.dev/app/content/set/coach%2Flesson%201",
    );
  });
});

describe("buildSetShareLink (#1572, #3819)", () => {
  it("gives a short link when the recipient can resolve the set", () => {
    const link = buildSetShareLink(
      { source: "astrapi69/alc-ai", branch: "main", id: "ki-einsteiger-from-de" },
      { short: true },
      "https://x.dev",
      "/app/",
    );
    expect(link).toBe("https://x.dev/app/content/set/ki-einsteiger-from-de");
  });

  it("maps an official or bundled set onto the official repo in an add-repo link", () => {
    for (const source of [OFFICIAL_SOURCE, "bundled:adaptive-learner-content"]) {
      const link = buildSetShareLink(
        { source, branch: "main", id: "psychologie-a1" },
        { short: false },
        "https://x.dev",
        "/",
      );
      expect(new URL(link).searchParams.get("repo")).toBe(OFFICIAL_SOURCE);
    }
  });

  it("uses the user repo source verbatim for a set only an add-repo link opens", () => {
    const link = buildSetShareLink(
      { source: "coach/deck", branch: "dev", id: "coach/lesson-1" },
      { short: false },
      "https://x.dev",
      "/",
    );
    const qs = new URL(link).searchParams;
    expect(qs.get("repo")).toBe("coach/deck");
    expect(qs.get("branch")).toBe("dev");
    expect(qs.get("set")).toBe("coach/lesson-1");
  });

  it.each([true, false])("NEVER leaks a token (short: %s)", (short) => {
    const link = buildSetShareLink(
      { source: "coach/private-deck", branch: "main", id: "secret-set" },
      { short },
      "https://x.dev",
      "/",
    );
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

  it.each([
    ["the repo param", "https://x.dev/app/add-repo?repo=jane/deck&set=fr-a1"],
    ["the url param of links shared before #3819", "https://x.dev/app/add-repo?url=jane%2Fdeck&branch=main&set=fr-a1"],
  ])("reads %s", (_label, link) => {
    expect(parseAddRepoQr(link)).toEqual({ url: "jane/deck", branch: "main", set: "fr-a1" });
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
      { short: false },
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
