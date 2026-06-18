/**
 * Tests for the presentational CurriculumCard (Curriculum Builder).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import CurriculumCard from "./CurriculumCard";

function renderCard(over = {}) {
    return render(
        <CurriculumCard
            name="My path"
            description="notes"
            done={2}
            total={5}
            nextLabel="03 articles"
            progressLabel="2 of 5 done"
            continueLabel="Continue"
            deleteLabel="Delete path"
            nextHintLabel="Next: 03 articles"
            testId="card"
            {...over}
        />,
    );
}

describe("CurriculumCard", () => {
    it("renders the name, description and progress", () => {
        renderCard();
        expect(screen.getByText("My path")).toBeInTheDocument();
        expect(screen.getByText("notes")).toBeInTheDocument();
        expect(screen.getByText("2 of 5 done")).toBeInTheDocument();
        expect(screen.getByTestId("card-next")).toHaveTextContent(
            "Next: 03 articles",
        );
    });

    it("fires onContinue when Continue is pressed", () => {
        const onContinue = vi.fn();
        renderCard({onContinue});
        fireEvent.click(screen.getByTestId("card-continue"));
        expect(onContinue).toHaveBeenCalledOnce();
    });

    it("fires onDelete when Delete is pressed", () => {
        const onDelete = vi.fn();
        renderCard({onDelete});
        fireEvent.click(screen.getByTestId("card-delete"));
        expect(onDelete).toHaveBeenCalledOnce();
    });

    it("disables Continue when there is no next lesson", () => {
        renderCard({nextLabel: undefined, nextHintLabel: undefined});
        expect(screen.getByTestId("card-continue")).toBeDisabled();
        expect(screen.queryByTestId("card-next")).toBeNull();
    });

    it("exposes the progressbar with done/total values", () => {
        renderCard();
        const bar = screen.getByRole("progressbar");
        expect(bar).toHaveAttribute("aria-valuenow", "2");
        expect(bar).toHaveAttribute("aria-valuemax", "5");
    });
});
