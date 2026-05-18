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

    it("renders three sliders with default value 3", () => {
        render(<RatingDialog open onSubmit={() => {}} onCancel={() => {}} />);
        expect(screen.getByTestId("rating-dialog")).toBeInTheDocument();
        expect(
            (screen.getByTestId("rating-understanding") as HTMLInputElement).value,
        ).toBe("3");
        expect((screen.getByTestId("rating-stress") as HTMLInputElement).value).toBe(
            "3",
        );
        expect(
            (screen.getByTestId("rating-method-fit") as HTMLInputElement).value,
        ).toBe("3");
        expect(screen.getByTestId("rating-understanding-value").textContent).toContain(
            "3",
        );
    });

    it("submits the current slider values plus notes", () => {
        const onSubmit = vi.fn();
        render(<RatingDialog open onSubmit={onSubmit} onCancel={() => {}} />);
        fireEvent.change(screen.getByTestId("rating-understanding"), {
            target: {value: "5"},
        });
        fireEvent.change(screen.getByTestId("rating-stress"), {
            target: {value: "2"},
        });
        fireEvent.change(screen.getByTestId("rating-method-fit"), {
            target: {value: "4"},
        });
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

    it("disables all controls while submitting", () => {
        render(
            <RatingDialog open submitting onSubmit={() => {}} onCancel={() => {}} />,
        );
        expect(
            (screen.getByTestId("rating-understanding") as HTMLInputElement).disabled,
        ).toBe(true);
        expect((screen.getByTestId("rating-submit") as HTMLButtonElement).disabled).toBe(
            true,
        );
        expect((screen.getByTestId("rating-cancel") as HTMLButtonElement).disabled).toBe(
            true,
        );
    });
});
