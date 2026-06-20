/**
 * Tests for ContentHub (#856): the single "Inhalte" destination at /content
 * with three tabs (Entdecken / Meine Inhalte / Importieren). The default tab is
 * Entdecken; the active tab lives in the ``?tab=`` query param.
 *
 * The three page components are mocked to lightweight stand-ins so the test
 * exercises ONLY the hub's tab bar + tab-selection wiring, not the real (heavy,
 * storage-backed) pages.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("./Discover", () => ({
  default: () => <div data-testid="mock-discover" />,
}));
vi.mock("./Content", () => ({
  default: () => <div data-testid="mock-content" />,
}));
vi.mock("./Import", () => ({
  default: () => <div data-testid="mock-import" />,
}));

import ContentHub from "./ContentHub";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ContentHub />
    </MemoryRouter>,
  );
}

describe("ContentHub", () => {
  it("renders the three tabs", () => {
    renderAt("/content");
    expect(screen.getByTestId("content-hub")).toBeInTheDocument();
    expect(screen.getByTestId("content-tab-discover")).toBeInTheDocument();
    expect(screen.getByTestId("content-tab-my")).toBeInTheDocument();
    expect(screen.getByTestId("content-tab-import")).toBeInTheDocument();
  });

  it("defaults to the Discover tab with no ?tab param", async () => {
    renderAt("/content");
    expect(await screen.findByTestId("mock-discover")).toBeInTheDocument();
    expect(screen.getByTestId("content-tab-discover")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByTestId("mock-content")).not.toBeInTheDocument();
  });

  it("opens the My-content tab from ?tab=my", async () => {
    renderAt("/content?tab=my");
    expect(await screen.findByTestId("mock-content")).toBeInTheDocument();
    expect(screen.getByTestId("content-tab-my")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("opens the Import tab from ?tab=import", async () => {
    renderAt("/content?tab=import");
    expect(await screen.findByTestId("mock-import")).toBeInTheDocument();
  });

  it("falls back to Discover for an unknown tab value", async () => {
    renderAt("/content?tab=bogus");
    expect(await screen.findByTestId("mock-discover")).toBeInTheDocument();
  });

  it("switches the mounted child when a tab is clicked", async () => {
    renderAt("/content");
    expect(await screen.findByTestId("mock-discover")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("content-tab-import"));
    expect(await screen.findByTestId("mock-import")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-discover")).not.toBeInTheDocument();
  });
});
