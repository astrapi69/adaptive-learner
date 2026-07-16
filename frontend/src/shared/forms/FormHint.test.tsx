/**
 * Tests for the shared FormHint helper-line component (#1629, additive Half A).
 *
 * Pins the 0-diff-by-construction contract for every form the migrated
 * consumers used: `<p>`/`<span>`, the `warning` modifier, an extra utility
 * class merged AFTER, and attribute passthrough — so it renders identically
 * to the `<p className="form-hint …">` it replaces.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FormHint from "./FormHint";

describe("FormHint (#1629)", () => {
  it("renders a <p class='form-hint'> by default", () => {
    render(<FormHint data-testid="h">hint</FormHint>);
    const el = screen.getByTestId("h");
    expect(el.tagName).toBe("P");
    expect(el.className).toBe("form-hint");
    expect(el).toHaveTextContent("hint");
  });

  it("renders a <span> when as='span'", () => {
    render(
      <FormHint as="span" data-testid="h">
        x
      </FormHint>,
    );
    const el = screen.getByTestId("h");
    expect(el.tagName).toBe("SPAN");
    expect(el.className).toBe("form-hint");
  });

  it("adds form-hint-warning for the warning variant", () => {
    render(
      <FormHint variant="warning" data-testid="h">
        x
      </FormHint>,
    );
    expect(screen.getByTestId("h").className).toBe("form-hint form-hint-warning");
  });

  it("merges an extra utility class AFTER form-hint", () => {
    render(
      <FormHint className="mb-2" data-testid="h">
        x
      </FormHint>,
    );
    expect(screen.getByTestId("h").className).toBe("form-hint mb-2");
  });

  it("combines warning + an extra class in the original order", () => {
    render(
      <FormHint variant="warning" className="text-warning" data-testid="h">
        x
      </FormHint>,
    );
    expect(screen.getByTestId("h").className).toBe(
      "form-hint form-hint-warning text-warning",
    );
  });

  it("passes through arbitrary attributes", () => {
    render(
      <FormHint data-testid="h" id="hint-1" role="note">
        x
      </FormHint>,
    );
    const el = screen.getByTestId("h");
    expect(el).toHaveAttribute("id", "hint-1");
    expect(el).toHaveAttribute("role", "note");
  });
});
