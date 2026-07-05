/**
 * Tests for the useAppUpdate hook (#613, #846, #1374). The hook is now a thin
 * adapter over the shared update store; these pin its public banner contract
 * (version.json detection, offline-skip, dismiss, accept-suppression) through
 * that store. The service-worker path is exercised by the dexie-smoke gate;
 * here navigator.serviceWorker is absent (happy-dom), which the store guards.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let online = true;
vi.mock("./useOnlineStatus", () => ({
  useOnlineStatus: () => online,
}));

// Stub the SW activation so applyUpdate does not call window.location.reload
// in the test (happy-dom has no navigation). We only assert it is invoked.
const { activateInBackground } = vi.hoisted(() => ({
  activateInBackground: vi.fn(),
}));
vi.mock("../../lib/pwa/sw-update", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/pwa/sw-update")>();
  return { ...actual, activateInBackground };
});

import { useAppUpdate } from "./useAppUpdate";
import { resetUpdateStore } from "../../lib/pwa/updateStore";

function mockFetchVersion(version: string) {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ version, buildHash: "test" }),
  })) as unknown as typeof fetch;
}

afterEach(() => {
  online = true;
  activateInBackground.mockClear();
  resetUpdateStore();
  localStorage.clear();
  sessionStorage.clear();
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
  // immediately AND trigger the service-worker activation.
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
  // reload that resets the in-memory store with version.json still newer.
  it("does not re-show the banner for an accepted version after a reload (#846)", async () => {
    mockFetchVersion("999.0.0");
    const first = renderHook(() => useAppUpdate());
    await waitFor(() => expect(first.result.current.updateAvailable).toBe(true));

    act(() => first.result.current.applyUpdate());
    expect(first.result.current.updateAvailable).toBe(false);
    first.unmount();

    // Simulate the reload: the in-memory store is cleared, but the recorded
    // acceptance (localStorage + session) survives and keeps it suppressed.
    resetUpdateStore();
    mockFetchVersion("999.0.0");
    const second = renderHook(() => useAppUpdate());
    await waitFor(() =>
      expect(second.result.current.latestVersion).toBe("999.0.0"),
    );
    expect(second.result.current.updateAvailable).toBe(false);
  });

  // #846: a genuinely NEWER version (after the quiet window, fresh session)
  // re-offers the banner.
  it("re-shows the banner for a newer version once the quiet window passed (#846)", async () => {
    const { recordUpdateAccepted } = await import("../../lib/pwa/update-accept");
    recordUpdateAccepted("999.0.0", Date.now() - 2 * 60 * 60 * 1000);
    // New browser session: the in-session guard does not carry over.
    sessionStorage.clear();

    mockFetchVersion("1000.0.0");
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.updateAvailable).toBe(true));
    expect(result.current.latestVersion).toBe("1000.0.0");
  });

  it("does not flag when the deployed version matches", async () => {
    mockFetchVersion(__APP_VERSION__);
    const { result } = renderHook(() => useAppUpdate());
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
    expect(result.current.updateAvailable).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Regression pin (#663): the banner is persistent — no auto-dismiss timer.
  it("stays visible over time — no auto-dismiss until the user acts (#663)", async () => {
    vi.useFakeTimers();
    mockFetchVersion("999.0.0");
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.updateAvailable).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(result.current.updateAvailable).toBe(true);
    vi.useRealTimers();

    act(() => result.current.dismiss());
    expect(result.current.updateAvailable).toBe(false);
  });
});
