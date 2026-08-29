/**
 * Tests for BottomTabBar (EXP-037 / #850; #856): the mobile primary
 * navigation — 5 tabs (Learn, Content, Learning Path, Progress, More) with a
 * "More" sheet for the secondary destinations (Settings, Help). #856 merged
 * the separate "Discover" tab into "Content" and promoted Learning Path from
 * the sheet into the primary bar. Hidden on the funnel and during a lesson.
 *
 * #2786: restored as an OPT-IN — the bar renders only with the
 * ``adaptive-learner.nav_position`` preference set to ``"bottom"``
 * (Settings > General > Interface); ``"top"`` (absent) is the default.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setNavPosition } from "../../hooks/settings/useNavPosition";
import BottomTabBar from "./BottomTabBar";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomTabBar />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // Most cases exercise the bar itself, so opt in; the default-top cases
  // clear this explicitly.
  localStorage.setItem("adaptive-learner.nav_position", "bottom");
});

afterEach(() => {
  localStorage.clear();
  document.body.classList.remove("has-bottom-nav");
});

describe("BottomTabBar", () => {
  it("does NOT render with the default nav position (top, #2786)", () => {
    localStorage.removeItem("adaptive-learner.nav_position");
    renderAt("/dashboard");
    expect(screen.queryByTestId("bottom-tab-bar")).not.toBeInTheDocument();
    expect(document.body.classList.contains("has-bottom-nav")).toBe(false);
  });

  it("mounts and unmounts live when the Settings choice flips (#2786)", () => {
    localStorage.removeItem("adaptive-learner.nav_position");
    renderAt("/dashboard");
    expect(screen.queryByTestId("bottom-tab-bar")).not.toBeInTheDocument();
    act(() => setNavPosition("bottom"));
    expect(screen.getByTestId("bottom-tab-bar")).toBeInTheDocument();
    act(() => setNavPosition("top"));
    expect(screen.queryByTestId("bottom-tab-bar")).not.toBeInTheDocument();
  });

  it("renders exactly 5 tabs on a normal route", () => {
    renderAt("/dashboard");
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
    // #856 — the separate Discover tab was merged into Content.
    expect(screen.queryByTestId("tab-discover")).not.toBeInTheDocument();
  });

  it("is hidden on the pre-onboarding funnel", () => {
    for (const path of ["/", "/onboarding", "/assessment"]) {
      const { unmount } = renderAt(path);
      expect(screen.queryByTestId("bottom-tab-bar")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("is hidden during an active lesson", () => {
    renderAt("/lesson/astrapi69--content/es-a1/01.json");
    expect(screen.queryByTestId("bottom-tab-bar")).not.toBeInTheDocument();
  });

  it("opens the More sheet with the secondary destinations", () => {
    renderAt("/dashboard");
    expect(screen.queryByTestId("more-sheet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tab-more"));
    expect(screen.getByTestId("more-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("more-settings")).toBeInTheDocument();
    expect(screen.getByTestId("more-help")).toBeInTheDocument();
    // #856 — Learning Path moved out of the sheet into the primary bar.
    expect(screen.queryByTestId("more-learning-path")).not.toBeInTheDocument();
  });

  it("closes the More sheet via the close button", () => {
    renderAt("/dashboard");
    fireEvent.click(screen.getByTestId("tab-more"));
    expect(screen.getByTestId("more-sheet")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("more-sheet-close"));
    expect(screen.queryByTestId("more-sheet")).not.toBeInTheDocument();
  });

  it("reserves bottom scroll space while mounted", () => {
    renderAt("/dashboard");
    expect(document.body.classList.contains("has-bottom-nav")).toBe(true);
  });

  it("does NOT reserve scroll space while hidden during a lesson (#1410)", () => {
    // The bar hides by rendering null WITHOUT unmounting; a mount-scoped
    // reservation left 4rem of dead bottom padding on #root, floating the
    // sticky lesson footer above the viewport bottom on ≤767px phones.
    renderAt("/lesson/astrapi69--content/es-a1/01.json");
    expect(document.body.classList.contains("has-bottom-nav")).toBe(false);
  });

  it("does NOT reserve scroll space on the funnel (#1410)", () => {
    renderAt("/onboarding");
    expect(document.body.classList.contains("has-bottom-nav")).toBe(false);
  });
});
