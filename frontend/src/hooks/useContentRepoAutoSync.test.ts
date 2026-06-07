/**
 * Tests for the 24h auto-sync threshold + the app-start hook
 * (EXP-023 Phase A/B — syncs every due connected repo).
 */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { readUserRepos, syncUserRepo } = vi.hoisted(() => ({
  readUserRepos: vi.fn(),
  syncUserRepo: vi.fn(),
}));
vi.mock("../lib/content/content-repos", async (orig) => ({
  ...(await orig<typeof import("../lib/content/content-repos")>()),
  readUserRepos,
  syncUserRepo,
}));

import { isUserRepoSyncDue, SYNC_THRESHOLD_MS } from "../lib/content/content-repos";
import { useContentRepoAutoSync } from "./useContentRepoAutoSync";

const fresh = () => new Date().toISOString();
const stale = () => new Date(Date.now() - SYNC_THRESHOLD_MS - 1000).toISOString();

describe("isUserRepoSyncDue", () => {
  const now = 1_000_000_000_000;
  it("due when never synced / unparseable, not when fresh", () => {
    expect(isUserRepoSyncDue(null, now)).toBe(true);
    expect(isUserRepoSyncDue("nonsense", now)).toBe(true);
    expect(isUserRepoSyncDue(new Date(now - 1000).toISOString(), now)).toBe(false);
  });
});

describe("useContentRepoAutoSync", () => {
  beforeEach(() => {
    readUserRepos.mockReset();
    syncUserRepo.mockReset();
    syncUserRepo.mockResolvedValue({ setCount: 1, lessonCount: 1 });
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("syncs only the connected, stale repos", async () => {
    readUserRepos.mockResolvedValue([
      { owner: "jane", repo: "a", connected: true, last_synced: stale() },
      { owner: "bob", repo: "b", connected: true, last_synced: fresh() },
      { owner: "kim", repo: "c", connected: false, last_synced: null },
    ]);
    renderHook(() => useContentRepoAutoSync());
    await waitFor(() => expect(syncUserRepo).toHaveBeenCalledTimes(1));
    expect(syncUserRepo).toHaveBeenCalledWith("jane/a");
  });

  it("does nothing with no repos", async () => {
    readUserRepos.mockResolvedValue([]);
    renderHook(() => useContentRepoAutoSync());
    await Promise.resolve();
    expect(syncUserRepo).not.toHaveBeenCalled();
  });

  it("skips entirely when offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    readUserRepos.mockResolvedValue([
      { owner: "jane", repo: "a", connected: true, last_synced: null },
    ]);
    renderHook(() => useContentRepoAutoSync());
    await Promise.resolve();
    expect(readUserRepos).not.toHaveBeenCalled();
  });
});
