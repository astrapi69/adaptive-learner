/**
 * Tests for content-repo share links (EXP-023 Phase B).
 */

import { describe, expect, it } from "vitest";

import { buildAddRepoLink } from "./share-link";

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
