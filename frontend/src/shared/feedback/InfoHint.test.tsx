import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import InfoHint from "./InfoHint";
import { INFO_BLINK_MAX_VISITS, readInfoHint, writeInfoHint } from "./infoHintPref";

function renderHint(overrides: Partial<React.ComponentProps<typeof InfoHint>> = {}) {
  return render(
    <InfoHint
      storageId="content_my"
      text="Pre-built lesson sets you can use without an API key."
      label="Show information"
      {...overrides}
    />,
  );
}

describe("InfoHint", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("replaces the permanent text with a button: text is hidden until the button is clicked, and toggles off again", () => {
    renderHint();
    // The explanatory text is NOT permanently visible.
    expect(screen.queryByTestId("info-hint-text")).toBeNull();
    const button = screen.getByTestId("info-hint-button");
    expect(button).toHaveAttribute("aria-expanded", "false");

    // Click -> the text expands inline.
    fireEvent.click(button);
    expect(screen.getByTestId("info-hint-text")).toHaveTextContent(
      "Pre-built lesson sets you can use without an API key.",
    );
    expect(button).toHaveAttribute("aria-expanded", "true");

    // Click again -> collapses.
    fireEvent.click(button);
    expect(screen.queryByTestId("info-hint-text")).toBeNull();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the id-specific text passed in (two tabs, two texts)", () => {
    const { unmount } = renderHint({
      storageId: "content_my",
      text: "My content explanation",
    });
    fireEvent.click(screen.getByTestId("info-hint-button"));
    expect(screen.getByTestId("info-hint-text")).toHaveTextContent("My content explanation");
    unmount();
    cleanup();
    localStorage.clear();

    renderHint({ storageId: "content_discover", text: "Discover explanation" });
    fireEvent.click(screen.getByTestId("info-hint-button"));
    expect(screen.getByTestId("info-hint-text")).toHaveTextContent("Discover explanation");
  });

  it("blinks for a fresh user (never seen, below the visit threshold)", () => {
    renderHint();
    expect(screen.getByTestId("info-hint-button")).toHaveAttribute("data-blink", "true");
  });

  it("stops blinking after the button is clicked, and persists that across re-mounts", () => {
    const { unmount } = renderHint();
    fireEvent.click(screen.getByTestId("info-hint-button"));
    expect(screen.getByTestId("info-hint-button")).not.toHaveAttribute("data-blink", "true");
    // Persisted as seen.
    expect(readInfoHint("content_my").seen).toBe(true);

    unmount();
    cleanup();
    // Re-mount: still no blink because the seen flag is persisted.
    renderHint();
    expect(screen.getByTestId("info-hint-button")).not.toHaveAttribute("data-blink", "true");
  });

  it("stops blinking once the visit count reaches the threshold without a click", () => {
    writeInfoHint("content_my", { seen: false, visits: INFO_BLINK_MAX_VISITS });
    renderHint();
    expect(screen.getByTestId("info-hint-button")).not.toHaveAttribute("data-blink", "true");
  });

  it("gates the blink animation behind motion-safe so reduced-motion users see none, but the button still works", () => {
    renderHint();
    const button = screen.getByTestId("info-hint-button");
    // The blink utility is CSS-gated via motion-safe: (no animation under prefers-reduced-motion).
    expect(button.className).toContain("motion-safe:");
    // The button is still fully operable regardless of motion preference.
    fireEvent.click(button);
    expect(screen.getByTestId("info-hint-text")).toBeInTheDocument();
  });
});
