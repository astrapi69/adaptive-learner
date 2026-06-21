/**
 * Unit tests for the multi user content-repository helpers
 * (EXP-023 Phase B). Pins parsing / source classification / namespacing,
 * the list config (read/migrate/write/add/remove/move), and per-repo sync.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const update = vi.fn();
const listSets = vi.fn();
const downloadSet = vi.fn();

vi.mock("../../../storage", () => ({
  getStorage: () => ({
    pluginSettings: { get, update },
    contentLoader: { listSets, downloadSet },
  }),
}));

const { validateUserRepo } = vi.hoisted(() => ({ validateUserRepo: vi.fn() }));
vi.mock("./content-repo-validate", () => ({ validateUserRepo }));
vi.mock("./repo-token", () => ({ resolveRepoToken: () => "" }));

import {
  addUserRepo,
  isOfficialSource,
  moveUserRepo,
  namespacedSetId,
  parseGitHubRepoUrl,
  readUserRepos,
  removeUserRepo,
  syncUserRepo,
  userRepoSource,
  writeUserRepos,
  type UserContentRepo,
} from "./content-repos";

function repo(owner: string, name: string): UserContentRepo {
  return {
    url: `https://github.com/${owner}/${name}`,
    owner,
    repo: name,
    branch: "main",
    connected: true,
    last_synced: null,
    set_count: 0,
    lesson_count: 0,
  };
}

beforeEach(() => {
  get.mockReset();
  update.mockReset();
  listSets.mockReset();
  downloadSet.mockReset();
  validateUserRepo.mockReset();
  validateUserRepo.mockResolvedValue({ ok: true, setCount: 0, lessonCount: 0 });
  update.mockResolvedValue({ plugin: "content-loader", settings: {} });
});

describe("parseGitHubRepoUrl", () => {
  it("parses https / ssh / shorthand", () => {
    expect(parseGitHubRepoUrl("https://github.com/jane/x")).toEqual({
      owner: "jane",
      repo: "x",
    });
    expect(parseGitHubRepoUrl("git@github.com:jane/x.git")).toEqual({
      owner: "jane",
      repo: "x",
    });
    expect(parseGitHubRepoUrl("jane/x")).toEqual({ owner: "jane", repo: "x" });
  });
  it("rejects empty / non-GitHub / malformed", () => {
    for (const bad of ["", "  ", "https://gitlab.com/a/b", "jane"]) {
      expect(parseGitHubRepoUrl(bad)).toBeNull();
    }
  });
});

describe("source + namespace helpers", () => {
  it("classifies official vs user and builds identifiers", () => {
    expect(isOfficialSource("astrapi69/adaptive-learner-content")).toBe(true);
    expect(isOfficialSource("bundled:adaptive-learner-content")).toBe(true);
    expect(isOfficialSource("jane/x")).toBe(false);
    expect(userRepoSource("jane", "x")).toBe("jane/x");
    expect(namespacedSetId("jane", "fr-a1")).toBe("jane/fr-a1");
  });
});

describe("readUserRepos — list + Phase A migration", () => {
  it("reads the user_repos array", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [repo("jane", "a"), repo("bob", "b")] },
    });
    const list = await readUserRepos();
    expect(list.map((r) => r.repo)).toEqual(["a", "b"]);
  });
  it("migrates a legacy single user_repo into a one-element list", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repo: repo("jane", "legacy") },
    });
    const list = await readUserRepos();
    expect(list).toHaveLength(1);
    expect(list[0].repo).toBe("legacy");
  });
  it("returns [] when none / on read error", async () => {
    get.mockResolvedValue({ plugin: "content-loader", settings: {} });
    expect(await readUserRepos()).toEqual([]);
    get.mockRejectedValue(new Error("boom"));
    expect(await readUserRepos()).toEqual([]);
  });
});

describe("writeUserRepos — preserves sources, drops legacy key", () => {
  it("writes user_repos and removes user_repo", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { default_sources: [{ source: "x" }], user_repo: repo("a", "b") },
    });
    await writeUserRepos([repo("jane", "a")]);
    const [, body] = update.mock.calls[0];
    expect(body.settings.default_sources).toBeDefined();
    expect(body.settings.user_repo).toBeUndefined();
    expect(body.settings.user_repos).toHaveLength(1);
  });
});

describe("addUserRepo / removeUserRepo / moveUserRepo", () => {
  it("appends new (highest precedence) and replaces same source", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [repo("jane", "a")] },
    });
    const after = await addUserRepo({ ...repo("bob", "b"), set_count: 3 });
    expect(after.map((r) => r.repo)).toEqual(["a", "b"]);
  });
  it("removes by source", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [repo("jane", "a"), repo("bob", "b")] },
    });
    const after = await removeUserRepo("jane/a");
    expect(after.map((r) => r.repo)).toEqual(["b"]);
  });
  it("moves a repo down (precedence change), no-op at the edge", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [repo("jane", "a"), repo("bob", "b")] },
    });
    const after = await moveUserRepo("jane/a", 1);
    expect(after.map((r) => r.repo)).toEqual(["b", "a"]);

    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [repo("jane", "a"), repo("bob", "b")] },
    });
    const noop = await moveUserRepo("jane/a", -1);
    expect(noop.map((r) => r.repo)).toEqual(["a", "b"]);
  });
});

describe("syncUserRepo(source)", () => {
  it("downloads only that repo's sets and persists fresh counts", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [repo("jane", "a"), repo("bob", "b")] },
    });
    listSets.mockResolvedValue({
      sets: [
        { source: "astrapi69/adaptive-learner-content", id: "fr", lesson_count: 10 },
        { source: "jane/a", id: "deck-1", lesson_count: 7 },
        { source: "jane/a", id: "deck-2", lesson_count: 5 },
        { source: "bob/b", id: "other", lesson_count: 9 },
      ],
    });
    downloadSet.mockResolvedValue({});

    const res = await syncUserRepo("jane/a");
    expect(res).toEqual({ setCount: 2, lessonCount: 12, trust: 1 });
    expect(downloadSet).toHaveBeenCalledTimes(2);
    expect(downloadSet).toHaveBeenCalledWith("jane/a", "deck-1");

    const [, body] = update.mock.calls[0];
    const jane = body.settings.user_repos.find(
      (r: UserContentRepo) => r.repo === "a",
    );
    expect(jane).toMatchObject({ set_count: 2, lesson_count: 12, trust: 1 });
    expect(jane.last_synced).toEqual(expect.any(String));
  });

  it("re-validation failure drops trust to 0", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [repo("jane", "a")] },
    });
    listSets.mockResolvedValue({ sets: [{ source: "jane/a", id: "d", lesson_count: 1 }] });
    downloadSet.mockResolvedValue({});
    validateUserRepo.mockResolvedValue({ ok: false, reason: "bad" });
    const res = await syncUserRepo("jane/a");
    expect(res.trust).toBe(0);
  });

  it("throws when the source is not connected", async () => {
    get.mockResolvedValue({ plugin: "content-loader", settings: {} });
    await expect(syncUserRepo("jane/a")).rejects.toThrow();
  });
});
