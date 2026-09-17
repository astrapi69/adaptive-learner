/**
 * ReorderRow / ReorderList (#3027) - the shared Up/Down list row of the
 * Settings reorder controls. Pins the layout that keeps labels readable on
 * a 375 px phone: the row wraps, the body slot takes the full width when
 * the arrow pair does not fit beside it, and the `<ol>` drops the
 * user-agent list indent (no Tailwind preflight in this app).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReorderList, ReorderRow } from "./ReorderRow";

function renderRow(
  overrides: Partial<Parameters<typeof ReorderRow>[0]> = {},
): { onMoveUp: ReturnType<typeof vi.fn>; onMoveDown: ReturnType<typeof vi.fn> } {
  const onMoveUp = vi.fn();
  const onMoveDown = vi.fn();
  render(
    <ReorderList testid="reorder-list">
      <ReorderRow
        index={1}
        count={3}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        moveUpLabel="Move up"
        moveDownLabel="Move down"
        testids={{ item: "row-b", up: "row-b-up", down: "row-b-down" }}
        {...overrides}
      >
        <span>Antworten-Übersicht</span>
      </ReorderRow>
    </ReorderList>,
  );
  return { onMoveUp, onMoveDown };
}

describe("ReorderRow", () => {
  it("renders the row with its testid, its content and both labelled arrows", () => {
    renderRow();
    const row = screen.getByTestId("row-b");
    expect(row.tagName).toBe("LI");
    expect(row).toHaveTextContent("Antworten-Übersicht");
    expect(screen.getByRole("button", { name: "Move up" })).toHaveAttribute(
      "data-testid",
      "row-b-up",
    );
    expect(screen.getByRole("button", { name: "Move down" })).toHaveAttribute(
      "data-testid",
      "row-b-down",
    );
  });

  it.each([
    { index: 0, count: 3, upDisabled: true, downDisabled: false, name: "first row" },
    { index: 1, count: 3, upDisabled: false, downDisabled: false, name: "middle row" },
    { index: 2, count: 3, upDisabled: false, downDisabled: true, name: "last row" },
    { index: 0, count: 1, upDisabled: true, downDisabled: true, name: "only row" },
  ])("disables the arrows at the list edges ($name)", ({ index, count, upDisabled, downDisabled }) => {
    renderRow({ index, count });
    expect(screen.getByTestId("row-b-up").hasAttribute("disabled")).toBe(upDisabled);
    expect(screen.getByTestId("row-b-down").hasAttribute("disabled")).toBe(downDisabled);
  });

  it("calls the move handlers on click", () => {
    const { onMoveUp, onMoveDown } = renderRow();
    fireEvent.click(screen.getByTestId("row-b-up"));
    fireEvent.click(screen.getByTestId("row-b-down"));
    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it("wraps the arrows under a full-width body instead of squeezing the label (#3027)", () => {
    renderRow();
    const row = screen.getByTestId("row-b");
    expect(row).toHaveClass("flex", "flex-wrap");
    const body = row.firstElementChild as HTMLElement;
    expect(body).toHaveClass("min-w-0", "flex-1", "basis-40");
    const arrows = screen.getByTestId("row-b-up").parentElement as HTMLElement;
    expect(arrows).toHaveClass("ml-auto", "shrink-0");
    for (const id of ["row-b-up", "row-b-down"]) {
      expect(screen.getByTestId(id)).toHaveClass("min-h-11");
    }
  });

  it("dims a muted row but keeps its arrows usable", () => {
    renderRow({ muted: true });
    expect(screen.getByTestId("row-b")).toHaveClass("opacity-60");
    expect(screen.getByTestId("row-b-up")).toBeEnabled();
  });

  it("ReorderList drops the user-agent list indent and carries the testid", () => {
    renderRow();
    const list = screen.getByTestId("reorder-list");
    expect(list.tagName).toBe("OL");
    expect(list).toHaveClass("list-none", "pl-0", "flex", "flex-col");
  });
});
