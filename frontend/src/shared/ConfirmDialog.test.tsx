/**
 * Tests for ConfirmDialog (#783) — the app confirmation modal that
 * replaces window.confirm. Pins: alertdialog a11y, title/message/
 * labels, confirm + cancel callbacks, Escape + backdrop cancel,
 * auto-focus on Cancel (safe default), and the danger variant.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConfirmDialog from "./ConfirmDialog";

function setup(overrides = {}) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
        <ConfirmDialog
            open
            title="Remove key"
            message="Really remove this API key?"
            confirmLabel="Remove"
            cancelLabel="Keep"
            onConfirm={onConfirm}
            onCancel={onCancel}
            {...overrides}
        />,
    );
    return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
    beforeEach(() => vi.clearAllMocks());

    it("renders nothing when closed", () => {
        render(
            <ConfirmDialog
                open={false}
                title="x"
                message="y"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("is an alertdialog with the title, message and labels", () => {
        setup();
        const dialog = screen.getByTestId("confirm-dialog");
        expect(dialog).toHaveAttribute("role", "alertdialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(screen.getByText("Remove key")).toBeInTheDocument();
        expect(screen.getByText("Really remove this API key?")).toBeInTheDocument();
        expect(screen.getByTestId("confirm-dialog-confirm")).toHaveTextContent("Remove");
        expect(screen.getByTestId("confirm-dialog-cancel")).toHaveTextContent("Keep");
    });

    it("auto-focuses the Cancel button (safe default)", () => {
        setup();
        expect(screen.getByTestId("confirm-dialog-cancel")).toHaveFocus();
    });

    it("fires onConfirm / onCancel on the buttons", () => {
        const { onConfirm, onCancel } = setup();
        fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId("confirm-dialog-cancel"));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("cancels on Escape and on backdrop click", () => {
        const { onCancel } = setup();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onCancel).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId("confirm-dialog-overlay"));
        expect(onCancel).toHaveBeenCalledTimes(2);
    });

    it("does not cancel when the card itself is clicked", () => {
        const { onCancel } = setup();
        fireEvent.click(screen.getByTestId("confirm-dialog"));
        expect(onCancel).not.toHaveBeenCalled();
    });

    it("uses a danger-styled confirm button for the danger variant", () => {
        setup({ variant: "danger" });
        expect(screen.getByTestId("confirm-dialog-confirm").className).toContain(
            "--danger",
        );
    });

    it("defaults labels to OK / Cancel", () => {
        render(
            <ConfirmDialog
                open
                title="t"
                message="m"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        expect(screen.getByTestId("confirm-dialog-confirm")).toHaveTextContent("OK");
        expect(screen.getByTestId("confirm-dialog-cancel")).toHaveTextContent("Cancel");
    });
});
