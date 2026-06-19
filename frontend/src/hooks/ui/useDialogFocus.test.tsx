/**
 * Tests for useDialogFocus (#515) — initial focus, focus trap, and
 * focus return for the hand-rolled .modal-overlay dialogs.
 */

import {fireEvent, render, screen} from "@testing-library/react";
import {useRef, useState} from "react";
import {afterEach, describe, expect, it} from "vitest";

import {useDialogFocus} from "./useDialogFocus";

/** A minimal dialog harness: a trigger button toggles the dialog. */
function Harness({autofocus = false}: {autofocus?: boolean}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useDialogFocus(ref, {open});
    return (
        <div>
            <button data-testid="trigger" onClick={() => setOpen(true)}>
                Open
            </button>
            {open && (
                <div ref={ref} role="dialog" aria-modal="true" data-testid="dialog">
                    <button data-testid="first">First</button>
                    <button data-testid="middle" data-autofocus={autofocus || undefined}>
                        Middle
                    </button>
                    <button data-testid="last" onClick={() => setOpen(false)}>
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}

describe("useDialogFocus", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("moves focus to the first focusable element on open", () => {
        render(<Harness />);
        fireEvent.click(screen.getByTestId("trigger"));
        expect(document.activeElement).toBe(screen.getByTestId("first"));
    });

    it("honours data-autofocus over first-focusable", () => {
        render(<Harness autofocus />);
        fireEvent.click(screen.getByTestId("trigger"));
        expect(document.activeElement).toBe(screen.getByTestId("middle"));
    });

    it("traps Tab from the last element back to the first", () => {
        render(<Harness />);
        fireEvent.click(screen.getByTestId("trigger"));
        const last = screen.getByTestId("last");
        last.focus();
        fireEvent.keyDown(screen.getByTestId("dialog"), {key: "Tab"});
        expect(document.activeElement).toBe(screen.getByTestId("first"));
    });

    it("traps Shift+Tab from the first element to the last", () => {
        render(<Harness />);
        fireEvent.click(screen.getByTestId("trigger"));
        const first = screen.getByTestId("first");
        first.focus();
        fireEvent.keyDown(screen.getByTestId("dialog"), {
            key: "Tab",
            shiftKey: true,
        });
        expect(document.activeElement).toBe(screen.getByTestId("last"));
    });

    it("returns focus to the trigger when the dialog closes", () => {
        render(<Harness />);
        const trigger = screen.getByTestId("trigger");
        trigger.focus();
        fireEvent.click(trigger);
        // Close via the in-dialog Close button.
        fireEvent.click(screen.getByTestId("last"));
        expect(screen.queryByTestId("dialog")).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });
});
