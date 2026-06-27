/**
 * Tests for DesktopSidebar (EXP-037 §7 Q1 / #891): the vertical desktop
 * primary navigation. Renders the EXP-037 grouped model (LEARN / CONTENT /
 * PROGRESS / MORE) reusing the same routes as the top bar + bottom bar, only
 * from the ``lg`` desktop breakpoint up. Mobile keeps the BottomTabBar
 * untouched; the sidebar is hidden on the funnel and during a lesson.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import DesktopSidebar from "./DesktopSidebar";
import BottomTabBar from "./BottomTabBar";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DesktopSidebar />
    </MemoryRouter>,
  );
}

afterEach(() => {
  document.body.classList.remove("has-desktop-sidebar");
  document.body.classList.remove("has-bottom-nav");
});

describe("DesktopSidebar", () => {
  it("renders the grouped primary entries pointing at the correct routes", () => {
    renderAt("/dashboard");
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    const expected: Record<string, string> = {
      "sidebar-dashboard": "/dashboard",
      "sidebar-learning-path": "/learning-path",
      "sidebar-session": "/session",
      "sidebar-content": "/content",
      "sidebar-contribute": "/contribute",
      "sidebar-progress": "/progress",
      "sidebar-settings": "/settings",
    };
    for (const [testId, href] of Object.entries(expected)) {
      const link = screen.getByTestId(testId);
      expect(link).toBeInTheDocument();
      expect(link.getAttribute("href")).toBe(href);
    }
    // Help is an in-place drawer opener (a button), not a route.
    expect(screen.getByTestId("sidebar-help").tagName).toBe("BUTTON");
  });

  it("only renders from the lg desktop breakpoint up (hidden lg:flex)", () => {
    renderAt("/dashboard");
    const sidebar = screen.getByTestId("desktop-sidebar");
    // The sidebar is gated to desktop widths: hidden by default, flex at lg.
    expect(sidebar.className).toContain("hidden");
    expect(sidebar.className).toContain("lg:flex");
  });

  it("marks the entry matching the current route as active (aria-current)", () => {
    renderAt("/progress");
    expect(screen.getByTestId("sidebar-progress")).toHaveAttribute(
      "aria-current",
      "page",
    );
    // A non-matching entry is not marked active.
    expect(screen.getByTestId("sidebar-dashboard")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("is hidden on the funnel and during an active lesson", () => {
    for (const path of ["/", "/onboarding", "/assessment"]) {
      const { unmount } = renderAt(path);
      expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
      unmount();
    }
    renderAt("/lesson/astrapi69--content/es-a1/01.json");
    expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
  });

  it("reserves left space via the has-desktop-sidebar body class while shown", () => {
    const { unmount } = renderAt("/dashboard");
    expect(document.body.classList.contains("has-desktop-sidebar")).toBe(true);
    unmount();
    expect(document.body.classList.contains("has-desktop-sidebar")).toBe(false);
  });

  it("does not disturb the mobile BottomTabBar (regression)", () => {
    // The mobile primary nav still renders its 5 tabs unchanged when the
    // sidebar is also mounted in the tree.
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DesktopSidebar />
        <BottomTabBar />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("bottom-tab-bar")).toBeInTheDocument();
    for (const id of [
      "tab-learn",
      "tab-content",
      "tab-learning-path",
      "tab-progress",
      "tab-more",
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });
});
