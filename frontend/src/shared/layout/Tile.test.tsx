/**
 * Tests for the shared Tile surface panel (#1629, additive Half A).
 *
 * Pins the 0-diff-by-construction contract: Tile emits the legacy ``tile``
 * class on a div, merges any extra utilities AFTER it (so a reflow override
 * wins), and passes attributes (data-testid, …) straight through — so it
 * renders identically to the ``<div className="tile …">`` it replaces.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Tile from "./Tile";

describe("Tile (#1629)", () => {
  it("renders a div carrying the legacy 'tile' class + its children", () => {
    render(<Tile data-testid="t">hello</Tile>);
    const el = screen.getByTestId("t");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveClass("tile");
    expect(el).toHaveTextContent("hello");
  });

  it("merges extra classes AFTER 'tile' (reflow override wins)", () => {
    render(
      <Tile className="flex flex-col items-start gap-2" data-testid="t">
        x
      </Tile>,
    );
    // Same class string the hand-written DashboardActivityTab used.
    expect(screen.getByTestId("t").className).toBe(
      "tile flex flex-col items-start gap-2",
    );
  });

  it("passes through arbitrary div attributes", () => {
    render(
      <Tile data-testid="t" id="panel" role="note">
        x
      </Tile>,
    );
    const el = screen.getByTestId("t");
    expect(el).toHaveAttribute("id", "panel");
    expect(el).toHaveAttribute("role", "note");
  });
});
