import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ActiveFilterChips, { type FilterChip } from "./ActiveFilterChips";

function chip(over: Partial<FilterChip> & { id: string }): FilterChip {
  return { label: over.label ?? over.id, onRemove: over.onRemove ?? vi.fn(), ...over };
}

describe("ActiveFilterChips (EXP-048 #2323)", () => {
  it("renders one removable mark per active filter", () => {
    render(
      <ActiveFilterChips
        chips={[
          chip({ id: "level", label: "Niveau: A1" }),
          chip({ id: "domain", label: "Bereich: Hundetraining" }),
        ]}
        removeLabel={(l) => `Entfernen: ${l}`}
        testId="discover-chips"
      />,
    );
    expect(screen.getByTestId("discover-chips")).toBeInTheDocument();
    expect(screen.getByTestId("discover-chips-level")).toHaveTextContent("Niveau: A1");
    expect(screen.getByTestId("discover-chips-domain")).toHaveTextContent(
      "Bereich: Hundetraining",
    );
    // Each mark carries an accessible remove control.
    expect(screen.getByTestId("discover-chips-remove-level")).toHaveAttribute(
      "aria-label",
      "Entfernen: Niveau: A1",
    );
  });

  it("fires onRemove for the mark whose X is clicked", () => {
    const onRemove = vi.fn();
    render(
      <ActiveFilterChips
        chips={[chip({ id: "trust", label: "Vertrauen: Offiziell", onRemove })]}
        removeLabel={(l) => `Remove ${l}`}
        testId="discover-chips"
      />,
    );
    fireEvent.click(screen.getByTestId("discover-chips-remove-trust"));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when there are no active filters", () => {
    const { container } = render(
      <ActiveFilterChips chips={[]} removeLabel={(l) => l} testId="discover-chips" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a reset-all action only when onClearAll is given, and fires it", () => {
    const onClearAll = vi.fn();
    const { rerender } = render(
      <ActiveFilterChips
        chips={[chip({ id: "level", label: "A1" })]}
        removeLabel={(l) => l}
        testId="discover-chips"
      />,
    );
    expect(screen.queryByTestId("discover-chips-clear-all")).toBeNull();
    rerender(
      <ActiveFilterChips
        chips={[chip({ id: "level", label: "A1" })]}
        removeLabel={(l) => l}
        onClearAll={onClearAll}
        clearAllLabel="Alle zurücksetzen"
        testId="discover-chips"
      />,
    );
    const clear = screen.getByTestId("discover-chips-clear-all");
    expect(clear).toHaveTextContent("Alle zurücksetzen");
    fireEvent.click(clear);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("is a horizontally-scrollable, non-wrapping row (mobile single-line filter surface)", () => {
    render(
      <ActiveFilterChips
        chips={[chip({ id: "level", label: "A1" })]}
        removeLabel={(l) => l}
        testId="discover-chips"
      />,
    );
    const row = screen.getByTestId("discover-chips");
    // A bar that eats half the phone height is no win (EXP-048 Teil 4): the
    // marks stay on ONE horizontally-scrollable line.
    expect(row.className).toContain("flex-nowrap");
    expect(row.className).toContain("overflow-x-auto");
  });
});
