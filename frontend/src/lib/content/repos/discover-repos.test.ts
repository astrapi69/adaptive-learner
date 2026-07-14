/**
 * Tests for the federated discovery-repo assembly (EXP-034 + governance).
 *
 * Verifies the registry contract on the consumer side: only VALIDATED
 * snapshots are searched, every EXTERNAL repo is pinned to its ``commit`` (not
 * the branch), the official repo stays branch-tracked, and the registry
 * ``trust_level`` seeds the ranking floor.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { RecommendedRepo } from "./recommended-repos";

const { fetchRecommendedRepos, readUserRepos } = vi.hoisted(() => ({
  fetchRecommendedRepos: vi.fn<() => Promise<RecommendedRepo[]>>(),
  readUserRepos: vi.fn(async () => [] as unknown[]),
}));

vi.mock("./recommended-repos", async () => {
  const actual = await vi.importActual<typeof import("./recommended-repos")>(
    "./recommended-repos",
  );
  return { ...actual, fetchRecommendedRepos };
});

vi.mock("./content-repos", async () => {
  const actual = await vi.importActual<typeof import("./content-repos")>(
    "./content-repos",
  );
  return { ...actual, readUserRepos };
});

vi.mock("./repo-token", () => ({ resolveRepoToken: () => "" }));

import { collectDiscoveryRepos } from "./discover-repos";

afterEach(() => {
  vi.clearAllMocks();
  readUserRepos.mockResolvedValue([]);
});

const OFFICIAL = "astrapi69/adaptive-learner-content";

describe("collectDiscoveryRepos", () => {
  it("always includes the official repo, branch-tracked at trust 3", async () => {
    fetchRecommendedRepos.mockResolvedValue([]);
    const repos = await collectDiscoveryRepos();
    expect(repos[0]).toMatchObject({
      url: OFFICIAL,
      branch: "main",
      trustLevel: 3,
    });
    expect(repos[0].ref).toBeUndefined(); // branch-tracked, no pin
  });

  it("pins a VALIDATED external repo to its commit and seeds trustLevel", async () => {
    const commit = "a".repeat(40);
    fetchRecommendedRepos.mockResolvedValue([
      {
        url: "https://github.com/jane/content",
        branch: "main",
        title: "Jane",
        commit,
        trust_level: 1,
        validation: { status: "validated", validated_at: "2026-07-09T00:00:00Z" },
      },
    ]);
    const repos = await collectDiscoveryRepos();
    const jane = repos.find((r) => r.url === "https://github.com/jane/content");
    expect(jane).toMatchObject({ ref: commit, trustLevel: 1, name: "Jane" });
  });

  it("excludes a pending / rejected / unpinned external entry from the search", async () => {
    fetchRecommendedRepos.mockResolvedValue([
      {
        url: "https://github.com/pending/x",
        branch: "main",
        commit: "b".repeat(40),
        validation: { status: "pending", validated_at: "2026-07-09T00:00:00Z" },
      },
      {
        url: "https://github.com/rejected/y",
        branch: "main",
        commit: "c".repeat(40),
        validation: { status: "rejected", validated_at: "2026-07-09T00:00:00Z" },
      },
      {
        // validated but missing the mandatory pinned commit
        url: "https://github.com/nopin/z",
        branch: "main",
        validation: { status: "validated", validated_at: "2026-07-09T00:00:00Z" },
      },
    ]);
    const repos = await collectDiscoveryRepos();
    expect(repos).toHaveLength(1); // only the official repo
    expect(repos[0].url).toBe(OFFICIAL);
  });

  it("dedupes the registry's self entry against the hardcoded official repo", async () => {
    fetchRecommendedRepos.mockResolvedValue([
      {
        url: `https://github.com/${OFFICIAL}`,
        branch: "main",
        self: true,
        trust_level: 3,
      },
    ]);
    const repos = await collectDiscoveryRepos();
    expect(repos.filter((r) => r.url.includes(OFFICIAL))).toHaveLength(1);
  });

  it("appends connected user repos not already in the registry", async () => {
    fetchRecommendedRepos.mockResolvedValue([]);
    readUserRepos.mockResolvedValue([
      { owner: "me", repo: "sets", branch: "dev" },
    ]);
    const repos = await collectDiscoveryRepos();
    expect(repos.find((r) => r.url === "me/sets")).toMatchObject({
      branch: "dev",
    });
  });
});
