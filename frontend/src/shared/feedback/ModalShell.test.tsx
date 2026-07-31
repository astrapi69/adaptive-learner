/**
 * Tests for ModalShell (#937): renders when open, scrollable body, and the
 * three dismiss paths (X button, Escape, backdrop click). A click inside the
 * card must NOT dismiss.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
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

  // #2266 — focus management: moved into the dialog on open, trapped
  // inside, and returned to the opener on close.
  it("moves focus into the dialog on open", () => {
    renderShell();
    const card = screen.getByTestId("m-card");
    expect(card.contains(document.activeElement)).toBe(true);
  });

  it("returns focus to the opener on close", () => {
    const onClose = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <div>
          <button data-testid="opener" onClick={() => setOpen(true)}>
            open
          </button>
          <ModalShell
            open={open}
            title="t"
            onClose={() => {
              onClose();
              setOpen(false);
            }}
            testId="m"
          >
            <p>body</p>
          </ModalShell>
        </div>
      );
    }
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    render(<Harness />);
    fireEvent.click(screen.getByTestId("m-x"));
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("traps Tab inside the dialog", () => {
    renderShell();
    const card = screen.getByTestId("m-card");
    const focusables = card.querySelectorAll("button");
    const last = focusables[focusables.length - 1] as HTMLElement;
    last.focus();
    fireEvent.keyDown(card, { key: "Tab" });
    expect(card.contains(document.activeElement)).toBe(true);
  });
});
