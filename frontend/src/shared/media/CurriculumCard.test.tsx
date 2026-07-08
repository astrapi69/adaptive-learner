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

    // #1458 - a path with zero lessons has nothing to continue. Instead
    // of a dead (disabled) Continue button, the card offers the one
    // action that makes sense: add lessons. The 0-of-0 progress block is
    // dead information and disappears with it.
    it("replaces Continue with the add-lessons action on an empty path (#1458)", () => {
        const onEmptyAction = vi.fn();
        renderCard({
            done: 0,
            total: 0,
            nextLabel: undefined,
            nextHintLabel: undefined,
            progressLabel: "0 of 0 done",
            emptyActionLabel: "Add your first lesson",
            onEmptyAction,
        });
        // No Continue button in the DOM (not merely disabled).
        expect(screen.queryByTestId("card-continue")).toBeNull();
        // The active add-lessons action replaces it and fires.
        const add = screen.getByTestId("card-add-lessons");
        expect(add).toBeEnabled();
        expect(add).toHaveTextContent("Add your first lesson");
        fireEvent.click(add);
        expect(onEmptyAction).toHaveBeenCalledOnce();
        // The meaningless 0-of-0 progress block is gone.
        expect(screen.queryByRole("progressbar")).toBeNull();
        expect(screen.queryByText("0 of 0 done")).toBeNull();
    });

    it("keeps Continue and the progress block once the path has lessons (#1458)", () => {
        const onContinue = vi.fn();
        renderCard({
            onContinue,
            emptyActionLabel: "Add your first lesson",
            onEmptyAction: vi.fn(),
        });
        // total=5: the empty-state action must NOT appear.
        expect(screen.queryByTestId("card-add-lessons")).toBeNull();
        expect(screen.getByRole("progressbar")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("card-continue"));
        expect(onContinue).toHaveBeenCalledOnce();
    });

    it("falls back to the disabled Continue on an empty path when no empty action is wired (#1458)", () => {
        renderCard({
            done: 0,
            total: 0,
            nextLabel: undefined,
            nextHintLabel: undefined,
        });
        // Backward compatible for hosts that do not pass the new props.
        expect(screen.getByTestId("card-continue")).toBeDisabled();
        expect(screen.queryByTestId("card-add-lessons")).toBeNull();
    });
});
