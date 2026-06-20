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

// Stub the SW activation so applyUpdate does not call window.location.reload
// in the test (happy-dom has no navigation). We only assert the hook calls it.
const { activateInBackground } = vi.hoisted(() => ({
  activateInBackground: vi.fn(),
}));
vi.mock("../../lib/pwa/sw-update", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/pwa/sw-update")>();
  return { ...actual, activateInBackground };
});

function mockFetchVersion(version: string) {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ version, buildHash: "test" }),
  })) as unknown as typeof fetch;
}

afterEach(() => {
  online = true;
  activateInBackground.mockClear();
  localStorage.clear();
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

  // Regression pin (#818): clicking "Aktualisieren" must hide the banner
  // immediately AND trigger the service-worker activation. Before the fix the
  // banner stayed (a plain reload was served stale from the old precache and
  // version.json still reported newer), so the button looked dead.
  it("applyUpdate hides the banner at once and triggers the background activation (#818)", async () => {
    mockFetchVersion("999.0.0");
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.updateAvailable).toBe(true));

    act(() => result.current.applyUpdate());

    expect(result.current.updateAvailable).toBe(false);
    expect(activateInBackground).toHaveBeenCalledTimes(1);
  });

  // Regression pin (#846): once the user clicks "Aktualisieren" the decision is
  // final — the banner must NOT reappear for that version, even across a (stale)
  // reload that re-mounts the hook with version.json still reporting newer.
  it("does not re-show the banner for an accepted version after a remount (#846)", async () => {
    mockFetchVersion("999.0.0");
    const first = renderHook(() => useAppUpdate());
    await waitFor(() => expect(first.result.current.updateAvailable).toBe(true));

    act(() => first.result.current.applyUpdate());
    expect(first.result.current.updateAvailable).toBe(false);
    first.unmount();

    // Re-mount (simulates the reload): version.json STILL reports 999.0.0, but
    // the recorded acceptance must keep the banner suppressed.
    mockFetchVersion("999.0.0");
    const second = renderHook(() => useAppUpdate());
    await waitFor(() =>
      expect(second.result.current.latestVersion).toBe("999.0.0"),
    );
    expect(second.result.current.updateAvailable).toBe(false);
  });

  // #846: a genuinely NEWER version (after the quiet window) re-offers the banner.
  it("re-shows the banner for a newer version once the quiet window passed (#846)", async () => {
    // Record an acceptance of 999.0.0 two hours ago.
    const { recordUpdateAccepted } = await import("../../lib/pwa/update-accept");
    recordUpdateAccepted("999.0.0", Date.now() - 2 * 60 * 60 * 1000);

    // A newer deploy appears.
    mockFetchVersion("1000.0.0");
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.updateAvailable).toBe(true));
    expect(result.current.latestVersion).toBe("1000.0.0");
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
