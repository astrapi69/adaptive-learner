/**
 * Tests for the shared FormHint helper-line component (#1629, Half B).
 *
 * Pins the token-backed contract: the defaults now live in the component as
 * Tailwind utilities (`text-fg-muted text-[0.85rem]` — the byte-for-byte
 * equivalent of the deleted legacy `.form-hint` rule), an extra utility is
 * merged AFTER (so a per-instance override wins), and attributes pass through.
 * The `warning` variant is currently visually identical to the default (the
 * `form-hint-warning` modifier never had a CSS rule); the prop is the seam for
 * a future warning-color pass.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FormHint from "./FormHint";

describe("FormHint (#1629)", () => {
  it("renders a <p> with the token-backed default utilities", () => {
    render(<FormHint data-testid="h">hint</FormHint>);
    const el = screen.getByTestId("h");
    expect(el.tagName).toBe("P");
    expect(el.className).toBe("text-fg-muted text-[0.85rem]");
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
    expect(el.className).toBe("text-fg-muted text-[0.85rem]");
  });

  it("renders the warning variant identically to the default (dead modifier)", () => {
    render(
      <FormHint variant="warning" data-testid="h">
        x
      </FormHint>,
    );
    expect(screen.getByTestId("h").className).toBe("text-fg-muted text-[0.85rem]");
  });

  it("merges an extra utility class AFTER the defaults", () => {
    render(
      <FormHint className="mb-2" data-testid="h">
        x
      </FormHint>,
    );
    expect(screen.getByTestId("h").className).toBe(
      "text-fg-muted text-[0.85rem] mb-2",
    );
  });

  it("lets a per-instance color override win (twMerge last-wins)", () => {
    render(
      <FormHint className="text-warning" data-testid="h">
        x
      </FormHint>,
    );
    // twMerge drops the conflicting `text-fg-muted`, keeps the size + override.
    expect(screen.getByTestId("h").className).toBe("text-[0.85rem] text-warning");
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
