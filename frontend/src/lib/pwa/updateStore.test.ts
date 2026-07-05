/**
 * Tests for the shared update store (#1374) — the single source of truth both
 * the global banner and the About "check for updates" control read.
 *
 * The reliable-check + activation primitives are stubbed (covered in
 * sw-update.test.ts); here we pin the store's state machine: one-pass checks,
 * passive detection, apply-clears-both, and offline retry.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { checkForUpdateReliable, activateInBackground } = vi.hoisted(() => ({
  checkForUpdateReliable: vi.fn(),
  activateInBackground: vi.fn(),
}));
vi.mock("./sw-update", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sw-update")>();
  return { ...actual, checkForUpdateReliable, activateInBackground };
});

import {
  applyUpdateNow,
  bannerVisible,
  checkUpdateNow,
  dismissUpdate,
  ensureUpdateStoreInit,
  getUpdateSnapshot,
  resetUpdateStore,
} from "./updateStore";

function mockFetchVersion(version: string) {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ version, buildHash: "test" }),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  resetUpdateStore();
});

afterEach(() => {
  checkForUpdateReliable.mockReset();
  activateInBackground.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("checkUpdateNow (one-pass explicit check)", () => {
  it("resolves 'available' in a single call — no second click needed (#1374)", async () => {
    checkForUpdateReliable.mockResolvedValue({
      status: "available",
      latestVersion: "1.86.0",
    });
    await checkUpdateNow();
    const s = getUpdateSnapshot();
    expect(s.phase).toBe("available");
    expect(s.updateAvailable).toBe(true);
    expect(s.latestVersion).toBe("1.86.0");
    expect(checkForUpdateReliable).toHaveBeenCalledTimes(1);
  });

  it("resolves 'current' when up to date", async () => {
    checkForUpdateReliable.mockResolvedValue({
      status: "current",
      latestVersion: "1.85.0",
    });
    await checkUpdateNow();
    const s = getUpdateSnapshot();
    expect(s.phase).toBe("current");
    expect(s.updateAvailable).toBe(false);
    expect(s.lastCheckedAt).not.toBeNull();
  });

  it("resolves 'error' on offline/timeout without losing a known update", async () => {
    // A passive detection already flagged an update…
    mockFetchVersion("999.0.0");
    ensureUpdateStoreInit(true);
    await vi.waitFor(() =>
      expect(getUpdateSnapshot().updateAvailable).toBe(true),
    );
    // …and a failed explicit check must not clear it.
    checkForUpdateReliable.mockResolvedValue({
      status: "error",
      latestVersion: null,
    });
    await checkUpdateNow();
    const s = getUpdateSnapshot();
    expect(s.phase).toBe("error");
    expect(s.updateAvailable).toBe(true);
  });
});

describe("ensureUpdateStoreInit (passive detection)", () => {
  it("flags updateAvailable when version.json is newer (shown on About without a click)", async () => {
    mockFetchVersion("999.0.0");
    ensureUpdateStoreInit(true);
    await vi.waitFor(() =>
      expect(getUpdateSnapshot().updateAvailable).toBe(true),
    );
    expect(getUpdateSnapshot().latestVersion).toBe("999.0.0");
  });

  it("does nothing while offline, and still runs on a later online start", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    ensureUpdateStoreInit(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    mockFetchVersion("999.0.0");
    ensureUpdateStoreInit(true);
    await vi.waitFor(() =>
      expect(getUpdateSnapshot().updateAvailable).toBe(true),
    );
  });
});

describe("applyUpdateNow (clears both indicators)", () => {
  it("records acceptance, clears the store, and drives background activation", async () => {
    checkForUpdateReliable.mockResolvedValue({
      status: "available",
      latestVersion: "1.86.0",
    });
    await checkUpdateNow();
    expect(bannerVisible()).toBe(true);

    applyUpdateNow();

    const s = getUpdateSnapshot();
    expect(s.updateAvailable).toBe(false);
    expect(s.dismissed).toBe(true);
    expect(activateInBackground).toHaveBeenCalledTimes(1);
    // Banner stays suppressed even if a stale reload re-flags the version.
    expect(bannerVisible()).toBe(false);
  });
});

describe("bannerVisible", () => {
  it("dismiss hides the banner for the session", async () => {
    mockFetchVersion("999.0.0");
    ensureUpdateStoreInit(true);
    await vi.waitFor(() => expect(bannerVisible()).toBe(true));
    dismissUpdate();
    expect(bannerVisible()).toBe(false);
  });
});
