/**
 * Unit tests for the user content-repository helpers (EXP-023 Phase A).
 *
 * Pins the pure parsing / source-classification / namespacing logic and
 * the read-modify-write config persistence (which must not clobber the
 * existing ``default_sources``).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const update = vi.fn();

vi.mock("../../storage", () => ({
  getStorage: () => ({ pluginSettings: { get, update } }),
}));

import {
  isOfficialSource,
  namespacedSetId,
  parseGitHubRepoUrl,
  readUserRepo,
  userRepoSource,
  writeUserRepo,
  type UserContentRepo,
} from "./content-repos";

const REPO: UserContentRepo = {
  url: "https://github.com/jane/my-content",
  owner: "jane",
  repo: "my-content",
  branch: "main",
  connected: true,
  last_synced: "2026-06-06T10:00:00.000Z",
  set_count: 2,
  lesson_count: 12,
};

beforeEach(() => {
  get.mockReset();
  update.mockReset();
});

describe("parseGitHubRepoUrl", () => {
  it("parses the https form, with and without trailing bits", () => {
    expect(parseGitHubRepoUrl("https://github.com/jane/my-content")).toEqual({
      owner: "jane",
      repo: "my-content",
    });
    expect(
      parseGitHubRepoUrl("https://github.com/jane/my-content.git"),
    ).toEqual({ owner: "jane", repo: "my-content" });
    expect(
      parseGitHubRepoUrl("https://github.com/jane/my-content/tree/main"),
    ).toEqual({ owner: "jane", repo: "my-content" });
  });

  it("parses the SSH and shorthand forms", () => {
    expect(parseGitHubRepoUrl("git@github.com:jane/my-content.git")).toEqual({
      owner: "jane",
      repo: "my-content",
    });
    expect(parseGitHubRepoUrl("jane/my-content")).toEqual({
      owner: "jane",
      repo: "my-content",
    });
  });

  it("returns null for empty / non-GitHub / malformed input", () => {
    expect(parseGitHubRepoUrl("")).toBeNull();
    expect(parseGitHubRepoUrl("   ")).toBeNull();
    expect(parseGitHubRepoUrl("https://gitlab.com/jane/x")).toBeNull();
    expect(parseGitHubRepoUrl("not a url")).toBeNull();
    expect(parseGitHubRepoUrl("jane")).toBeNull();
  });
});

describe("isOfficialSource", () => {
  it("treats the canonical repo and any bundled source as official", () => {
    expect(isOfficialSource("astrapi69/adaptive-learner-content")).toBe(true);
    expect(isOfficialSource("bundled:adaptive-learner-content")).toBe(true);
  });

  it("treats a user repo source as not official", () => {
    expect(isOfficialSource("jane/my-content")).toBe(false);
    expect(isOfficialSource("user-generated")).toBe(false);
  });
});

describe("source + namespace helpers", () => {
  it("builds an owner/repo source identifier", () => {
    expect(userRepoSource("jane", "my-content")).toBe("jane/my-content");
  });

  it("namespaces a set id with the owner", () => {
    expect(namespacedSetId("jane", "fr-a1")).toBe("jane/fr-a1");
  });
});

describe("readUserRepo / writeUserRepo", () => {
  it("returns the stored repo when present", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repo: REPO, default_sources: [{ source: "x" }] },
    });
    await expect(readUserRepo()).resolves.toEqual(REPO);
  });

  it("returns null when no user_repo is set", async () => {
    get.mockResolvedValue({ plugin: "content-loader", settings: {} });
    await expect(readUserRepo()).resolves.toBeNull();
  });

  it("returns null (never throws) when the read fails", async () => {
    get.mockRejectedValue(new Error("boom"));
    await expect(readUserRepo()).resolves.toBeNull();
  });

  it("writes user_repo without clobbering default_sources", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { default_sources: [{ source: "official" }] },
    });
    await writeUserRepo(REPO);
    expect(update).toHaveBeenCalledWith("content-loader", {
      settings: {
        default_sources: [{ source: "official" }],
        user_repo: REPO,
      },
    });
  });

  it("clears user_repo on write(null)", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { default_sources: [], user_repo: REPO },
    });
    await writeUserRepo(null);
    expect(update).toHaveBeenCalledWith("content-loader", {
      settings: { default_sources: [] },
    });
  });
});
