import {render, screen, fireEvent} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import RatingDialog from "./RatingDialog";

describe("RatingDialog", () => {
    it("renders nothing when open is false", () => {
        render(
            <RatingDialog open={false} onSubmit={() => {}} onCancel={() => {}} />,
        );
        expect(screen.queryByTestId("rating-dialog")).not.toBeInTheDocument();
    });

    it("renders three 5-button rating groups with default value 3", () => {
        render(<RatingDialog open onSubmit={() => {}} onCancel={() => {}} />);
        expect(screen.getByTestId("rating-dialog")).toBeInTheDocument();
        // The row-level testid still points at the wrapping group; the
        // five 1..5 buttons sit under ``${row}-${n}``.
        expect(screen.getByTestId("rating-understanding")).toBeInTheDocument();
        // Default value 3 → the n=3 button is active, others are not.
        for (const n of [1, 2, 3, 4, 5]) {
            const btn = screen.getByTestId(`rating-understanding-${n}`);
            expect(btn.getAttribute("aria-checked")).toBe(n === 3 ? "true" : "false");
        }
        // Visible "3 / 5" caption.
        expect(
            screen.getByTestId("rating-understanding-value").textContent,
        ).toContain("3");
    });

    it("clicking a 1-5 button updates the active state for that row only", () => {
        render(<RatingDialog open onSubmit={() => {}} onCancel={() => {}} />);
        fireEvent.click(screen.getByTestId("rating-understanding-5"));
        // Row 1 — only n=5 active.
        for (const n of [1, 2, 3, 4, 5]) {
            const btn = screen.getByTestId(`rating-understanding-${n}`);
            expect(btn.getAttribute("aria-checked")).toBe(n === 5 ? "true" : "false");
        }
        // Other rows untouched.
        expect(
            screen.getByTestId("rating-stress-3").getAttribute("aria-checked"),
        ).toBe("true");
        // Caption reflects the new value for the changed row.
        expect(
            screen.getByTestId("rating-understanding-value").textContent,
        ).toContain("5");
    });

    it("submits the current button values plus notes", () => {
        const onSubmit = vi.fn();
        render(<RatingDialog open onSubmit={onSubmit} onCancel={() => {}} />);
        fireEvent.click(screen.getByTestId("rating-understanding-5"));
        fireEvent.click(screen.getByTestId("rating-stress-2"));
        fireEvent.click(screen.getByTestId("rating-method-fit-4"));
        fireEvent.change(screen.getByTestId("rating-notes"), {
            target: {value: "Klare Methode."},
        });
        fireEvent.click(screen.getByTestId("rating-submit"));
        expect(onSubmit).toHaveBeenCalledWith({
            understanding: 5,
            stress: 2,
            method_fit: 4,
            notes: "Klare Methode.",
        });
    });

    it("fires onCancel on the Cancel button", () => {
        const onCancel = vi.fn();
        render(<RatingDialog open onSubmit={() => {}} onCancel={onCancel} />);
        fireEvent.click(screen.getByTestId("rating-cancel"));
        expect(onCancel).toHaveBeenCalled();
    });

    it("disables all rating buttons + submit + cancel while submitting", () => {
        render(
            <RatingDialog open submitting onSubmit={() => {}} onCancel={() => {}} />,
        );
        for (const n of [1, 2, 3, 4, 5]) {
            expect(
                (screen.getByTestId(`rating-understanding-${n}`) as HTMLButtonElement)
                    .disabled,
            ).toBe(true);
        }
        expect((screen.getByTestId("rating-submit") as HTMLButtonElement).disabled).toBe(
            true,
        );
        expect((screen.getByTestId("rating-cancel") as HTMLButtonElement).disabled).toBe(
            true,
        );
    });

    it("each rating group has role=radiogroup with role=radio children", () => {
        render(<RatingDialog open onSubmit={() => {}} onCancel={() => {}} />);
        const groups = screen.getAllByRole("radiogroup");
        // 3 rating rows + the role="radiogroup" emitted nowhere else
        // in the dialog → exactly 3.
        expect(groups).toHaveLength(3);
        // Each group hosts 5 role=radio buttons.
        for (const g of groups) {
            const radios = g.querySelectorAll('[role="radio"]');
            expect(radios.length).toBe(5);
        }
    });
});
