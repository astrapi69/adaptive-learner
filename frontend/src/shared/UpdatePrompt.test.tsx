/**
 * Tests for the presentational UpdatePrompt banner (#613).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import UpdatePrompt from "./UpdatePrompt";

describe("UpdatePrompt", () => {
  function setup() {
    const onUpdate = vi.fn();
    const onDismiss = vi.fn();
    render(
      <UpdatePrompt
        message="A new version is available."
        updateLabel="Update"
        dismissLabel="Later"
        onUpdate={onUpdate}
        onDismiss={onDismiss}
      />,
    );
    return { onUpdate, onDismiss };
  }

  it("renders the message + both actions, announced via role=status", () => {
    setup();
    expect(screen.getByTestId("update-prompt")).toHaveAttribute(
      "role",
      "status",
    );
    expect(
      screen.getByText("A new version is available."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("update-prompt-apply")).toHaveTextContent(
      "Update",
    );
    expect(screen.getByTestId("update-prompt-dismiss")).toHaveAttribute(
      "aria-label",
      "Later",
    );
  });

  it("fires onUpdate / onDismiss", () => {
    const { onUpdate, onDismiss } = setup();
    fireEvent.click(screen.getByTestId("update-prompt-apply"));
    expect(onUpdate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("update-prompt-dismiss"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("anchors to the bottom with safe-area padding, below the modal layer (#653)", () => {
    // Regression pin: a top anchor collided with the app nav (desktop) and
    // the iOS-Safari address bar (mobile). The banner must sit at the bottom,
    // pad the iPhone home indicator, and stay below the z-50 modal layer.
    setup();
    const bar = screen.getByTestId("update-prompt");
    expect(bar.className).toContain("bottom-0");
    expect(bar.className).not.toContain("top-0");
    expect(bar.className).toContain("z-40");
    expect(bar.className).toContain("pb-[env(safe-area-inset-bottom)]");
  });

  it("uses AA-pinned token pairs: neutral surface + accent CTA (#649, #653)", () => {
    // Regression pin: bar = --bg-card surface + --fg-primary text, update
    // action = --accent / --accent-fg. All three pairings are enforced
    // >= WCAG AA across all 12 themes by contrast.test.ts, so a drift back to
    // a theme-dependent / same-colour pair re-opens the invisible-text bug.
    setup();
    const bar = screen.getByTestId("update-prompt");
    expect(bar.className).toContain("bg-card");
    expect(bar.className).toContain("text-fg-primary");

    const apply = screen.getByTestId("update-prompt-apply");
    expect(apply.className).toContain("bg-accent");
    expect(apply.className).toContain("text-accent-foreground");

    // Touch target >= 44px on both actions.
    expect(apply.className).toContain("min-h-[44px]");
    const dismiss = screen.getByTestId("update-prompt-dismiss");
    expect(dismiss.className).toContain("min-h-[44px]");
    expect(dismiss.className).toContain("min-w-[44px]");
  });
});
