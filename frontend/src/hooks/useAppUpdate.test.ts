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
  vi.useRealTimers();
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

  // Regression pin (#663): the update banner is persistent. It must NOT
  // auto-dismiss on a timer — once flagged it stays visible until the user
  // explicitly applies the update or dismisses it (dismiss re-offers on the
  // next full app start). The hook holds no setTimeout/setInterval that
  // clears the flag; advancing the clock far past any plausible toast
  // auto-close window must leave it visible.
  it("stays visible over time — no auto-dismiss until the user acts (#663)", async () => {
    // Fake timers are installed BEFORE render so any timer the hook
    // schedules at mount (the regression we are pinning against) is a fake
    // timer that advancing the clock would fire.
    vi.useFakeTimers();
    mockFetchVersion("999.0.0");
    const { result } = renderHook(() => useAppUpdate());

    // Flush the async version.json fetch so the update is flagged.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.updateAvailable).toBe(true);

    // Advance well past any plausible auto-close window. A mount-scheduled
    // auto-dismiss timer would fire here and (wrongly) hide the banner;
    // the persistent banner must remain visible.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(result.current.updateAvailable).toBe(true);
    vi.useRealTimers();

    // Only an explicit user action hides it.
    act(() => result.current.dismiss());
    expect(result.current.updateAvailable).toBe(false);
  });
});
