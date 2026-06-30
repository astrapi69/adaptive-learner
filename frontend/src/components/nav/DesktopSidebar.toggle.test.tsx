/**
 * Tests for the desktop sidebar open/close toggle (#1260).
 *
 * The vertical desktop sidebar (#891) gains an open/close toggle:
 * - a close affordance inside the sidebar (``sidebar-toggle``),
 * - an open affordance in the top bar (``sidebar-open-toggle``), shown
 *   only while the sidebar is collapsed,
 * both driven by ONE shared mechanism ({@link DesktopSidebarProvider}).
 *
 * The sidebar collapses on a nav-link tap (and navigates), on an outside
 * pointerdown, and on Escape — drawer behavior that gives the content the
 * full width. The toggle only affects the ``>= lg`` sidebar mode; the
 * #891 breakpoint markup (``hidden lg:flex`` on the sidebar, the top bar's
 * inline links) is unchanged.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import DesktopSidebar from "./DesktopSidebar";
import Navigation from "./Navigation";
import { DesktopSidebarProvider } from "../../contexts/DesktopSidebarContext";

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

function renderLayout(path = "/dashboard") {
  return render(
    <DesktopSidebarProvider>
      <MemoryRouter initialEntries={[path]}>
        <Navigation />
        <DesktopSidebar />
        <div data-testid="content-area">content</div>
        <LocationProbe />
      </MemoryRouter>
    </DesktopSidebarProvider>,
  );
}

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  document.body.classList.remove("has-desktop-sidebar");
});

describe("DesktopSidebar open/close toggle (#1260)", () => {
  it("toggles the sidebar closed then open again (round-trip)", () => {
    renderLayout();
    // Default open: sidebar present, close affordance present, no open toggle.
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    const closeBtn = screen.getByTestId("sidebar-toggle");
    expect(closeBtn.getAttribute("aria-expanded")).toBe("true");
    expect(closeBtn.getAttribute("aria-controls")).toBe("desktop-sidebar");
    expect(screen.queryByTestId("sidebar-open-toggle")).not.toBeInTheDocument();

    // Close it.
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
    const openBtn = screen.getByTestId("sidebar-open-toggle");
    expect(openBtn.getAttribute("aria-expanded")).toBe("false");
    expect(openBtn.getAttribute("aria-controls")).toBe("desktop-sidebar");

    // Open it again.
    fireEvent.click(openBtn);
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-open-toggle")).not.toBeInTheDocument();
  });

  it("reserves left space (has-desktop-sidebar) only while open", () => {
    renderLayout();
    expect(document.body.classList.contains("has-desktop-sidebar")).toBe(true);
    fireEvent.click(screen.getByTestId("sidebar-toggle"));
    expect(document.body.classList.contains("has-desktop-sidebar")).toBe(false);
  });

  it("closes the sidebar on a nav-link tap AND navigates", () => {
    render(
      <DesktopSidebarProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <DesktopSidebar />
          <Routes>
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </DesktopSidebarProvider>,
    );
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sidebar-progress"));
    // Navigated…
    expect(screen.getByTestId("location").textContent).toBe("/progress");
    // …and the sidebar collapsed.
    expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
  });

  it("closes the sidebar on an outside pointerdown (drawer behavior)", () => {
    renderLayout();
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId("content-area"));
    expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
  });

  it("does NOT close on a pointerdown inside the sidebar", () => {
    renderLayout();
    fireEvent.pointerDown(screen.getByTestId("sidebar-brand"));
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
  });

  it("closes the sidebar on Escape", () => {
    renderLayout();
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
  });

  it("does not steal focus on initial mount when already open", () => {
    renderLayout();
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    // The close toggle exists but did not grab focus on load.
    expect(document.activeElement).not.toBe(screen.getByTestId("sidebar-toggle"));
  });

  it("moves focus to the close toggle when the user opens the sidebar", () => {
    localStorage.setItem("adaptive-learner.desktop_sidebar_open", "false");
    renderLayout();
    // Start collapsed.
    expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sidebar-open-toggle"));
    // Opened by the user → focus lands inside the sidebar (the close toggle).
    expect(document.activeElement).toBe(screen.getByTestId("sidebar-toggle"));
  });

  it("regression: leaves the #891 breakpoint markup intact", () => {
    renderLayout();
    // Sidebar stays desktop-gated (hidden by default, flex at lg).
    const sidebar = screen.getByTestId("desktop-sidebar");
    expect(sidebar.className).toContain("hidden");
    expect(sidebar.className).toContain("lg:flex");
    // The open toggle is desktop-only (hidden below lg) once shown.
    fireEvent.click(screen.getByTestId("sidebar-toggle"));
    const openBtn = screen.getByTestId("sidebar-open-toggle");
    expect(openBtn.className).toContain("hidden");
    expect(openBtn.className).toContain("lg:inline-flex");
    // The top bar (768–1024 + mobile drawer) keeps its inline links + the
    // mobile hamburger untouched.
    expect(screen.getByTestId("nav-links")).toBeInTheDocument();
    expect(screen.getByTestId("nav-hamburger")).toBeInTheDocument();
  });
});
