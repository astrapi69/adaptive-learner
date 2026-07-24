/**
 * Tests for ProgressHub (EXP-037 / #850): the tabbed Fortschritt page that
 * merges Übersicht / Statistik / Meine Pfade. The embedded page components are
 * stubbed — the hub's job is the tab bar + active-tab selection, not the
 * children's data loading.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import ProgressHub from "./ProgressHub";

vi.mock("./Progress", () => ({
  default: () => <div data-testid="stub-overview" />,
}));
vi.mock("./LearningStatistics", () => ({
  default: () => <div data-testid="stub-stats" />,
}));
vi.mock("../content/Curriculum", () => ({
  default: () => <div data-testid="stub-paths" />,
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ProgressHub />
    </MemoryRouter>,
  );
}

describe("ProgressHub", () => {
  it("renders the 3 tabs", () => {
    renderAt("/progress");
    expect(screen.getByTestId("progress-hub")).toBeInTheDocument();
    expect(screen.getByTestId("progress-tab-overview")).toBeInTheDocument();
    expect(screen.getByTestId("progress-tab-stats")).toBeInTheDocument();
    expect(screen.getByTestId("progress-tab-paths")).toBeInTheDocument();
  });

  it("defaults to the Übersicht tab", async () => {
    renderAt("/progress");
    expect(
      screen.getByTestId("progress-tab-overview").getAttribute("aria-selected"),
    ).toBe("true");
    expect(await screen.findByTestId("stub-overview")).toBeInTheDocument();
  });

  it("opens the Statistik tab from ?tab=stats", async () => {
    renderAt("/progress?tab=stats");
    expect(
      screen.getByTestId("progress-tab-stats").getAttribute("aria-selected"),
    ).toBe("true");
    expect(await screen.findByTestId("stub-stats")).toBeInTheDocument();
  });

  it("opens the Meine-Pfade tab from ?tab=paths", async () => {
    renderAt("/progress?tab=paths");
    expect(await screen.findByTestId("stub-paths")).toBeInTheDocument();
  });

  it("switches tab on click", async () => {
    renderAt("/progress");
    fireEvent.click(screen.getByTestId("progress-tab-stats"));
    expect(
      screen.getByTestId("progress-tab-stats").getAttribute("aria-selected"),
    ).toBe("true");
    expect(await screen.findByTestId("stub-stats")).toBeInTheDocument();
  });
});
