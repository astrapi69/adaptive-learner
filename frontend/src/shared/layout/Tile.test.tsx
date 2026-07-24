/**
 * Tests for the shared Tile surface panel (#1629, Half B).
 *
 * Pins the token-backed contract: the defaults now live in the component as
 * Tailwind utilities (the byte-for-byte equivalent of the deleted legacy
 * `.tile` rule), a reflow override merges AFTER via `cn()` so it wins (align
 * flips, but the un-overridden `justify-center` is preserved exactly as the
 * old legacy rule left it), and attributes pass through.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Tile from "./Tile";

const DEFAULT_CLASSES = [
  "flex",
  "min-h-[120px]",
  "items-center",
  "justify-center",
  "rounded-[var(--radius-md)]",
  "bg-[var(--surface-2)]",
  "p-[var(--space-4)]",
];

describe("Tile (#1629)", () => {
  it("renders a div carrying the token-backed default utilities + children", () => {
    render(<Tile data-testid="t">hello</Tile>);
    const el = screen.getByTestId("t");
    expect(el.tagName).toBe("DIV");
    for (const cls of DEFAULT_CLASSES) expect(el).toHaveClass(cls);
    expect(el).toHaveTextContent("hello");
  });

  it("lets a reflow override win but keeps the surface + un-overridden defaults", () => {
    render(
      <Tile className="flex flex-col items-start gap-2" data-testid="t">
        x
      </Tile>,
    );
    const el = screen.getByTestId("t");
    // The override flips alignment/direction...
    expect(el).toHaveClass("flex", "flex-col", "items-start", "gap-2");
    expect(el).not.toHaveClass("items-center");
    // ...but the surface + un-overridden `justify-center` survive (0-diff with
    // the old legacy `.tile`, which the reflow div only partially overrode).
    expect(el).toHaveClass(
      "justify-center",
      "min-h-[120px]",
      "rounded-[var(--radius-md)]",
      "bg-[var(--surface-2)]",
      "p-[var(--space-4)]",
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
