/**
 * ExerciseSuccessAdvance (#1218).
 *
 * The success-merge control shown in place of the redundant
 * "My answer" / "Solution" toggle once an exercise is answered
 * correctly: a success badge plus a single "Continue" action that
 * drives the lesson's forward navigation.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import ExerciseSuccessAdvance from "./ExerciseSuccessAdvance";

describe("ExerciseSuccessAdvance", () => {
    it("renders a success badge and a Continue button", () => {
        render(
            <ExerciseSuccessAdvance
                onAdvance={vi.fn()}
                testIdPrefix="word-tiles"
            />,
        );
        expect(
            screen.getByTestId("word-tiles-success-advance"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("word-tiles-advance")).toBeInTheDocument();
    });

    it("calls onAdvance when the Continue button is clicked", () => {
        const onAdvance = vi.fn();
        render(
            <ExerciseSuccessAdvance
                onAdvance={onAdvance}
                testIdPrefix="cloze"
            />,
        );
        fireEvent.click(screen.getByTestId("cloze-advance"));
        expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it("uses the provided advance label", () => {
        render(
            <ExerciseSuccessAdvance
                onAdvance={vi.fn()}
                label="Finish lesson"
                testIdPrefix="cloze"
            />,
        );
        expect(screen.getByTestId("cloze-advance")).toHaveTextContent(
            "Finish lesson",
        );
    });

    it("moves focus to the Continue button on mount (keyboard reach)", () => {
        render(
            <ExerciseSuccessAdvance
                onAdvance={vi.fn()}
                testIdPrefix="free-text"
            />,
        );
        expect(screen.getByTestId("free-text-advance")).toHaveFocus();
    });
});
