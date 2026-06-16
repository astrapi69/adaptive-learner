/**
 * Tests for the useAppUpdate hook (#613): version.json detection,
 * offline-skip, and dismiss. The service-worker path is exercised by the
 * dexie-smoke gate; here navigator.serviceWorker is absent (happy-dom),
 * which the hook guards.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAppUpdate } from "./useAppUpdate";

let online = true;
vi.mock("./useOnlineStatus", () => ({
  useOnlineStatus: () => online,
}));

function mockFetchVersion(version: string) {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ version, buildHash: "test" }),
  })) as unknown as typeof fetch;
}

afterEach(() => {
  online = true;
  vi.restoreAllMocks();
});

describe("useAppUpdate", () => {
  it("flags an update when version.json is newer, and dismiss hides it", async () => {
    mockFetchVersion("999.0.0");
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.updateAvailable).toBe(true));
    expect(result.current.latestVersion).toBe("999.0.0");
    act(() => result.current.dismiss());
    expect(result.current.updateAvailable).toBe(false);
  });

  it("does not flag when the deployed version matches", async () => {
    mockFetchVersion(__APP_VERSION__);
    const { result } = renderHook(() => useAppUpdate());
    // Give the effect a tick to resolve.
    await waitFor(() =>
      expect(result.current.latestVersion).toBe(__APP_VERSION__),
    );
    expect(result.current.updateAvailable).toBe(false);
  });

  it("skips the check while offline (no fetch, no update)", async () => {
    online = false;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { result } = renderHook(() => useAppUpdate());
    // Nothing to await — the effect returns early when offline.
    expect(result.current.updateAvailable).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
