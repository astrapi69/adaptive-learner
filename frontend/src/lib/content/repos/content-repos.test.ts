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

const { validateUserRepo, listRepoManifestSets } = vi.hoisted(() => ({
  validateUserRepo: vi.fn(),
  listRepoManifestSets: vi.fn(),
}));
vi.mock("./content-repo-validate", () => ({ validateUserRepo, listRepoManifestSets }));
vi.mock("./repo-token", () => ({ resolveRepoToken: () => "" }));

import {
  addUserRepo,
  isOfficialSource,
  moveUserRepo,
  namespacedSetId,
  parseGitHubRepoUrl,
  readUserRepos,
  removeUserRepo,
  resolveRepoCategory,
  syncUserRepo,
  userRepoSource,
  writeUserRepos,
  OFFICIAL_SOURCE,
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
  listRepoManifestSets.mockReset();
  listRepoManifestSets.mockResolvedValue([]);
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
  it("reads the set list from the TARGET repo's own manifest and downloads only its sets (#1388)", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [repo("jane", "a"), repo("bob", "b")] },
    });
    listRepoManifestSets.mockResolvedValue([
      { id: "deck-1", lessonCount: 7 },
      { id: "deck-2", lessonCount: 5 },
    ]);
    downloadSet.mockResolvedValue({});

    const res = await syncUserRepo("jane/a");
    expect(res).toEqual({ setCount: 2, lessonCount: 12, trust: 1 });
    expect(listRepoManifestSets).toHaveBeenCalledWith(
      { owner: "jane", repo: "a", branch: "main" },
      "",
    );
    expect(downloadSet).toHaveBeenCalledTimes(2);
    expect(downloadSet).toHaveBeenCalledWith("jane/a", "deck-1");
    expect(downloadSet).toHaveBeenCalledWith("jane/a", "deck-2");

    const [, body] = update.mock.calls[0];
    const jane = body.settings.user_repos.find(
      (r: UserContentRepo) => r.repo === "a",
    );
    expect(jane).toMatchObject({ set_count: 2, lesson_count: 12, trust: 1 });
    expect(jane.last_synced).toEqual(expect.any(String));
  });

  it("touches ONLY the target source — no listSets over all sources, no other-repo writes (#1388)", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [repo("jane", "a"), repo("bob", "b")] },
    });
    listRepoManifestSets.mockResolvedValue([{ id: "deck-1", lessonCount: 7 }]);
    downloadSet.mockResolvedValue({});

    await syncUserRepo("jane/a");
    // The all-source catalogue walk is what made one row's sync hit every
    // configured repo's network endpoint — it must not run at all.
    expect(listSets).not.toHaveBeenCalled();
    // The sibling repo's stored row is byte-identical.
    const [, body] = update.mock.calls[0];
    const bob = body.settings.user_repos.find(
      (r: UserContentRepo) => r.repo === "b",
    );
    expect(bob).toEqual(repo("bob", "b"));
  });

  it("re-validation failure drops trust to 0", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [repo("jane", "a")] },
    });
    listRepoManifestSets.mockResolvedValue([{ id: "d", lessonCount: 1 }]);
    downloadSet.mockResolvedValue({});
    validateUserRepo.mockResolvedValue({ ok: false, reason: "bad" });
    const res = await syncUserRepo("jane/a");
    expect(res.trust).toBe(0);
  });

  it("propagates an unreachable-repo failure (row feedback) without writing anything", async () => {
    get.mockResolvedValue({
      plugin: "content-loader",
      settings: { user_repos: [repo("jane", "a")] },
    });
    listRepoManifestSets.mockRejectedValue(new Error("404"));
    await expect(syncUserRepo("jane/a")).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
    expect(downloadSet).not.toHaveBeenCalled();
  });

  it("throws when the source is not connected", async () => {
    get.mockResolvedValue({ plugin: "content-loader", settings: {} });
    await expect(syncUserRepo("jane/a")).rejects.toThrow();
  });
});

describe("resolveRepoCategory (#1319)", () => {
  it("classifies the official + bundled sources as official", () => {
    expect(resolveRepoCategory({ source: OFFICIAL_SOURCE })).toBe("official");
    expect(resolveRepoCategory({ source: "bundled:fr-a1" })).toBe("official");
  });

  it("classifies an officially-recommended user repo as official", () => {
    expect(
      resolveRepoCategory({ source: "jane/deck", recommended: true, trust: 1 }),
    ).toBe("official");
  });

  it("classifies a coach (private-token) repo as private", () => {
    expect(
      resolveRepoCategory({ source: "jane/deck", coach: true, trust: 1 }),
    ).toBe("private");
  });

  it("classifies a validated community repo as validated", () => {
    expect(resolveRepoCategory({ source: "jane/deck", trust: 1 })).toBe(
      "validated",
    );
  });

  it("classifies a freshly-added community repo as unverified", () => {
    expect(resolveRepoCategory({ source: "jane/deck", trust: 0 })).toBe(
      "unverified",
    );
    expect(resolveRepoCategory({ source: "jane/deck" })).toBe("unverified");
  });

  it("gives origin (official/private) precedence over the trust axis", () => {
    // A bundled/official source stays official even at trust 0.
    expect(resolveRepoCategory({ source: OFFICIAL_SOURCE, trust: 0 })).toBe(
      "official",
    );
    // A coach repo stays private even when unvalidated.
    expect(
      resolveRepoCategory({ source: "jane/deck", coach: true, trust: 0 }),
    ).toBe("private");
  });
});
