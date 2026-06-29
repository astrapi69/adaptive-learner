/**
 * ContentViewToggle (#1240) — grid ⇄ list switch.
 *
 * Pins: both options render, aria-pressed reflects the active mode,
 * and clicking the inactive option calls onChange with that mode.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ContentViewToggle from "./ContentViewToggle";

describe("ContentViewToggle", () => {
  it("marks the active mode with aria-pressed", () => {
    render(<ContentViewToggle mode="grid" onChange={vi.fn()} />);
    expect(screen.getByTestId("content-view-grid")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("content-view-list")).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with 'list' when the list option is clicked", () => {
    const onChange = vi.fn();
    render(<ContentViewToggle mode="grid" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("content-view-list"));
    expect(onChange).toHaveBeenCalledWith("list");
  });

  it("calls onChange with 'grid' when the grid option is clicked from list mode", () => {
    const onChange = vi.fn();
    render(<ContentViewToggle mode="list" onChange={onChange} />);
    expect(screen.getByTestId("content-view-list")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("content-view-grid"));
    expect(onChange).toHaveBeenCalledWith("grid");
  });
});
