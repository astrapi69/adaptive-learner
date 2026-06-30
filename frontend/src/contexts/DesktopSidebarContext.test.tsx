/**
 * Tests for the DesktopSidebar open/close context (#1260).
 *
 * Holds the runtime open/closed state of the vertical desktop sidebar
 * (#891) shared between the top bar's open toggle and the sidebar's own
 * close toggle. ``toggle`` is the explicit user action and PERSISTS the
 * choice to localStorage; ``collapse`` is the transient drawer close
 * (navigation / outside-click / Escape) and does NOT persist, so a reload
 * restores the user's last deliberate preference.
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  DesktopSidebarProvider,
  useDesktopSidebar,
} from "./DesktopSidebarContext";

const STORAGE_KEY = "adaptive-learner.desktop_sidebar_open";

function Probe() {
  const { open, toggle, collapse } = useDesktopSidebar();
  return (
    <div>
      <span data-testid="state">{open ? "open" : "closed"}</span>
      <button data-testid="toggle" onClick={toggle} />
      <button data-testid="collapse" onClick={collapse} />
    </div>
  );
}

function renderProbe() {
  return render(
    <DesktopSidebarProvider>
      <Probe />
    </DesktopSidebarProvider>,
  );
}

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe("DesktopSidebarContext", () => {
  it("defaults to open on a fresh install (no stored preference)", () => {
    renderProbe();
    expect(screen.getByTestId("state").textContent).toBe("open");
  });

  it("toggle flips the state and persists the new value", () => {
    renderProbe();
    act(() => screen.getByTestId("toggle").click());
    expect(screen.getByTestId("state").textContent).toBe("closed");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("false");
    act(() => screen.getByTestId("toggle").click());
    expect(screen.getByTestId("state").textContent).toBe("open");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("reads the persisted preference on mount (survives re-mount)", () => {
    localStorage.setItem(STORAGE_KEY, "false");
    const { unmount } = renderProbe();
    expect(screen.getByTestId("state").textContent).toBe("closed");
    unmount();
    // A fresh provider mount reads the same persisted value.
    renderProbe();
    expect(screen.getByTestId("state").textContent).toBe("closed");
  });

  it("collapse closes the sidebar WITHOUT persisting (transient drawer close)", () => {
    renderProbe();
    expect(screen.getByTestId("state").textContent).toBe("open");
    act(() => screen.getByTestId("collapse").click());
    expect(screen.getByTestId("state").textContent).toBe("closed");
    // The deliberate preference is untouched — a reload would restore "open".
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("falls back to a usable no-op shape outside the provider", () => {
    // No provider — the bare hook must not throw and defaults to open.
    function Bare() {
      const { open } = useDesktopSidebar();
      return <span data-testid="bare">{open ? "open" : "closed"}</span>;
    }
    render(<Bare />);
    expect(screen.getByTestId("bare").textContent).toBe("open");
  });
});
