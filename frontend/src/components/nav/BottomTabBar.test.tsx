/**
 * Tests for BottomTabBar (EXP-037 / #850): the mobile primary navigation —
 * 5 tabs (Learn, Content, Discover, Progress, More) with a "More" sheet for the
 * secondary destinations. Hidden on the pre-onboarding funnel and during a
 * lesson.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import BottomTabBar from "./BottomTabBar";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomTabBar />
    </MemoryRouter>,
  );
}

afterEach(() => {
  document.body.classList.remove("has-bottom-nav");
});

describe("BottomTabBar", () => {
  it("renders exactly 5 tabs on a normal route", () => {
    renderAt("/dashboard");
    expect(screen.getByTestId("bottom-tab-bar")).toBeInTheDocument();
    for (const id of [
      "tab-learn",
      "tab-content",
      "tab-discover",
      "tab-progress",
      "tab-more",
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
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
    expect(screen.getByTestId("more-learning-path")).toBeInTheDocument();
    expect(screen.getByTestId("more-settings")).toBeInTheDocument();
    expect(screen.getByTestId("more-help")).toBeInTheDocument();
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
});
