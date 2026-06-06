/**
 * Tests for the 24h auto-sync threshold + the app-start hook
 * (EXP-023 Phase A, commit 5).
 */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { readUserRepo, syncUserRepo } = vi.hoisted(() => ({
  readUserRepo: vi.fn(),
  syncUserRepo: vi.fn(),
}));
vi.mock("../lib/content/content-repos", async (orig) => ({
  ...(await orig<typeof import("../lib/content/content-repos")>()),
  readUserRepo,
  syncUserRepo,
}));

import { isUserRepoSyncDue, SYNC_THRESHOLD_MS } from "../lib/content/content-repos";
import { useContentRepoAutoSync } from "./useContentRepoAutoSync";

describe("isUserRepoSyncDue", () => {
  const now = 1_000_000_000_000;
  it("is due when never synced", () => {
    expect(isUserRepoSyncDue(null, now)).toBe(true);
  });
  it("is due past the threshold, not before", () => {
    const old = new Date(now - SYNC_THRESHOLD_MS - 1).toISOString();
    const fresh = new Date(now - 1000).toISOString();
    expect(isUserRepoSyncDue(old, now)).toBe(true);
    expect(isUserRepoSyncDue(fresh, now)).toBe(false);
  });
  it("is due on an unparseable timestamp", () => {
    expect(isUserRepoSyncDue("not-a-date", now)).toBe(true);
  });
});

describe("useContentRepoAutoSync", () => {
  beforeEach(() => {
    readUserRepo.mockReset();
    syncUserRepo.mockReset();
    syncUserRepo.mockResolvedValue({ setCount: 1, lessonCount: 1 });
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("syncs a connected, stale repo", async () => {
    readUserRepo.mockResolvedValue({ connected: true, last_synced: null });
    renderHook(() => useContentRepoAutoSync());
    await waitFor(() => expect(syncUserRepo).toHaveBeenCalledTimes(1));
  });

  it("does not sync a fresh repo", async () => {
    readUserRepo.mockResolvedValue({
      connected: true,
      last_synced: new Date().toISOString(),
    });
    renderHook(() => useContentRepoAutoSync());
    await Promise.resolve();
    expect(syncUserRepo).not.toHaveBeenCalled();
  });

  it("does nothing when no repo is connected", async () => {
    readUserRepo.mockResolvedValue(null);
    renderHook(() => useContentRepoAutoSync());
    await Promise.resolve();
    expect(syncUserRepo).not.toHaveBeenCalled();
  });

  it("skips when offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    readUserRepo.mockResolvedValue({ connected: true, last_synced: null });
    renderHook(() => useContentRepoAutoSync());
    await Promise.resolve();
    expect(readUserRepo).not.toHaveBeenCalled();
  });
});
