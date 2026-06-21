/**
 * Tests for ModalShell (#937): renders when open, scrollable body, and the
 * three dismiss paths (X button, Escape, backdrop click). A click inside the
 * card must NOT dismiss.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ModalShell from "./ModalShell";

function renderShell(onClose = vi.fn()) {
  render(
    <ModalShell open title="My dialog" onClose={onClose} testId="m">
      <p>body content</p>
      <button type="button" data-testid="inner-btn">
        inner
      </button>
    </ModalShell>,
  );
  return onClose;
}

describe("ModalShell", () => {
  it("renders nothing when closed", () => {
    render(
      <ModalShell open={false} title="x" onClose={vi.fn()} testId="m">
        <p>hidden</p>
      </ModalShell>,
    );
    expect(screen.queryByTestId("m")).toBeNull();
  });

  it("renders the title + body and a scrollable body container", () => {
    renderShell();
    expect(screen.getByTestId("m-title")).toHaveTextContent("My dialog");
    expect(screen.getByText("body content")).toBeInTheDocument();
    expect(screen.getByTestId("m-body").className).toContain("overflow-y-auto");
  });

  it("closes via the X button", () => {
    const onClose = renderShell();
    fireEvent.click(screen.getByTestId("m-x"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const onClose = renderShell();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a backdrop click but NOT on a click inside the card", () => {
    const onClose = renderShell();
    fireEvent.click(screen.getByTestId("inner-btn"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("m")); // backdrop overlay
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses role=dialog + aria-modal", () => {
    renderShell();
    const card = screen.getByTestId("m-card");
    expect(card).toHaveAttribute("role", "dialog");
    expect(card).toHaveAttribute("aria-modal", "true");
  });
});
