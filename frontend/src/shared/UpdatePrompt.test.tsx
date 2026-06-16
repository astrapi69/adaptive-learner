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
});
