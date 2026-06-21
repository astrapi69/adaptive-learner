/**
 * S2 (PWA hardening) tests for the offline status banner.
 *
 * Drives navigator.onLine + the online/offline window events and
 * asserts the banner shows offline, the "back online" flash shows on
 * reconnect, and the dismiss button hides it.
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import OfflineIndicator from "./OfflineIndicator";

vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

function fireConnectivity(event: "online" | "offline") {
  act(() => {
    window.dispatchEvent(new Event(event));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setOnline(true);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  setOnline(true);
});

describe("OfflineIndicator", () => {
  it("renders nothing while online", () => {
    setOnline(true);
    render(<OfflineIndicator />);
    expect(screen.queryByTestId("offline-indicator")).toBeNull();
    expect(screen.queryByTestId("online-flash")).toBeNull();
  });

  it("shows the offline banner when navigator.onLine is false at mount", () => {
    setOnline(false);
    render(<OfflineIndicator />);
    expect(screen.getByTestId("offline-indicator")).toBeInTheDocument();
    expect(
      screen.getByText("You're offline. Saved content is available."),
    ).toBeInTheDocument();
  });

  it("shows the banner on an offline event and the flash on reconnect", () => {
    setOnline(true);
    render(<OfflineIndicator />);
    expect(screen.queryByTestId("offline-indicator")).toBeNull();

    setOnline(false);
    fireConnectivity("offline");
    expect(screen.getByTestId("offline-indicator")).toBeInTheDocument();

    setOnline(true);
    fireConnectivity("online");
    // Offline bar gone, "back online" flash shown.
    expect(screen.queryByTestId("offline-indicator")).toBeNull();
    expect(screen.getByTestId("online-flash")).toBeInTheDocument();

    // Flash auto-hides after 2s.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId("online-flash")).toBeNull();
  });

  it("dismiss hides the offline banner", () => {
    setOnline(false);
    render(<OfflineIndicator />);
    act(() => {
      screen.getByTestId("offline-indicator-dismiss").click();
    });
    expect(screen.queryByTestId("offline-indicator")).toBeNull();
  });

  it("re-shows the banner on a new offline transition after dismissal", () => {
    setOnline(false);
    render(<OfflineIndicator />);
    act(() => {
      screen.getByTestId("offline-indicator-dismiss").click();
    });
    expect(screen.queryByTestId("offline-indicator")).toBeNull();

    // Reconnect, then drop again — the bar should return.
    setOnline(true);
    fireConnectivity("online");
    setOnline(false);
    fireConnectivity("offline");
    expect(screen.getByTestId("offline-indicator")).toBeInTheDocument();
  });
});
