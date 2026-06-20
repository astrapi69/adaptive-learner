/**
 * Tests for DiscoverHub (EXP-037 / #850): the tabbed Entdecken page that merges
 * Discover + Import. Embedded pages stubbed; the hub owns the tab bar + tab
 * selection.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import DiscoverHub from "./DiscoverHub";

vi.mock("./Discover", () => ({
  default: () => <div data-testid="stub-discover" />,
}));
vi.mock("./Import", () => ({
  default: () => <div data-testid="stub-import" />,
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DiscoverHub />
    </MemoryRouter>,
  );
}

describe("DiscoverHub", () => {
  it("renders the 2 tabs", () => {
    renderAt("/discover");
    expect(screen.getByTestId("discover-hub")).toBeInTheDocument();
    expect(screen.getByTestId("discover-tab-discover")).toBeInTheDocument();
    expect(screen.getByTestId("discover-tab-import")).toBeInTheDocument();
  });

  it("defaults to the Discover tab", async () => {
    renderAt("/discover");
    expect(
      screen.getByTestId("discover-tab-discover").getAttribute("aria-selected"),
    ).toBe("true");
    expect(await screen.findByTestId("stub-discover")).toBeInTheDocument();
  });

  it("opens the Import tab from ?tab=import", async () => {
    renderAt("/discover?tab=import");
    expect(
      screen.getByTestId("discover-tab-import").getAttribute("aria-selected"),
    ).toBe("true");
    expect(await screen.findByTestId("stub-import")).toBeInTheDocument();
  });

  it("switches tab on click", async () => {
    renderAt("/discover");
    fireEvent.click(screen.getByTestId("discover-tab-import"));
    expect(await screen.findByTestId("stub-import")).toBeInTheDocument();
  });
});
