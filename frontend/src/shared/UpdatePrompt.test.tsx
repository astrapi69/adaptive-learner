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

  it("paints the bar with the AA-pinned accent pair (#649)", () => {
    // Regression pin: the banner must use --accent / --accent-fg, the one
    // token pair whose contrast is enforced >= WCAG AA across all 12 themes
    // (contrast.test.ts). A drift back to a theme-dependent pair (e.g.
    // bg-bg-elevated + text-fg-primary) would re-open the invisible-text bug.
    setup();
    const bar = screen.getByTestId("update-prompt");
    expect(bar.className).toContain("bg-accent");
    expect(bar.className).toContain("text-accent-foreground");

    // The update action is the inverse chip (accent-fg surface, accent text),
    // so it reads clearly as a button on the accent bar.
    const apply = screen.getByTestId("update-prompt-apply");
    expect(apply.className).toContain("bg-accent-foreground");
    expect(apply.className).toContain("text-accent");
  });
});
