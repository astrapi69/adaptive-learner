/**
 * Tests for the presentational UpdatePrompt banner (#613, #653).
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

  it("renders the message with non-empty visible text (#653)", () => {
    // Regression pin: the banner must always carry visible copy. An empty
    // message would render an invisible-but-present bar.
    setup();
    const message = screen.getByText("A new version is available.");
    expect(message.textContent?.trim()).not.toBe("");
  });

  it("fires onUpdate / onDismiss", () => {
    const { onUpdate, onDismiss } = setup();
    fireEvent.click(screen.getByTestId("update-prompt-apply"));
    expect(onUpdate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("update-prompt-dismiss"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("is bottom-anchored, not top-anchored (#653)", () => {
    // Regression pin: a top-anchored banner is unreachable on iPhone Safari
    // (under the address bar, hidden by pull-to-refresh). It must sit at the
    // bottom and clear the iOS home indicator (safe-area-inset padding).
    setup();
    const bar = screen.getByTestId("update-prompt");
    expect(bar.className).toContain("bottom-0");
    expect(bar.className).not.toContain("top-0");
    expect(bar.className).toContain("env(safe-area-inset-bottom)");
    // High z-index so it is never hidden behind app chrome.
    expect(bar.className).toContain("z-[9999]");
  });

  it("paints the bar with the AA-pinned surface/text pair (#653)", () => {
    // Regression pin: the bar uses --bg-surface / --fg-primary, the pairing
    // contrast.test.ts enforces >= WCAG AA across all 12 themes. The prior
    // accent-on-accent fill (#649) regressed to invisible text on the live
    // site; a drift back to a non-pinned pair would re-open the bug.
    setup();
    const bar = screen.getByTestId("update-prompt");
    expect(bar.className).toContain("bg-bg-surface");
    expect(bar.className).toContain("text-fg-primary");
    expect(bar.className).toContain("border-t");

    // The update action is the accent button (accent surface, accent-fg
    // text — also AA-pinned), so it reads as the primary CTA.
    const apply = screen.getByTestId("update-prompt-apply");
    expect(apply.className).toContain("bg-accent");
    expect(apply.className).toContain("text-accent-foreground");
  });

  it("buttons meet the 44px minimum touch target (#653)", () => {
    setup();
    const apply = screen.getByTestId("update-prompt-apply");
    const dismiss = screen.getByTestId("update-prompt-dismiss");
    expect(apply.className).toContain("min-h-[44px]");
    expect(dismiss.className).toContain("min-h-[44px]");
    expect(dismiss.className).toContain("min-w-[44px]");
  });
});
