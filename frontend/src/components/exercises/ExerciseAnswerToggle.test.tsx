/**
 * Tests for the reusable ExerciseAnswerToggle (#1005).
 *
 * Pins the My-answer / Solution segmented control: both buttons render
 * with the testid prefix, ``aria-pressed`` tracks the active view, and the
 * click handlers fire. The component is pure presentation (the caller owns
 * the view state and the render branches).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import ExerciseAnswerToggle from "./ExerciseAnswerToggle";

describe("ExerciseAnswerToggle", () => {
    it("renders both buttons with the testid prefix", () => {
        render(
            <ExerciseAnswerToggle
                view="my-answer"
                onShowMyAnswer={() => {}}
                onShowSolution={() => {}}
                testIdPrefix="word-tiles"
            />,
        );
        expect(screen.getByTestId("word-tiles-answer-toggle")).toBeInTheDocument();
        expect(screen.getByTestId("word-tiles-my-answer")).toBeInTheDocument();
        expect(screen.getByTestId("word-tiles-solution")).toBeInTheDocument();
    });

    it("reflects the active view via aria-pressed", () => {
        const {rerender} = render(
            <ExerciseAnswerToggle
                view="my-answer"
                onShowMyAnswer={() => {}}
                onShowSolution={() => {}}
            />,
        );
        expect(screen.getByTestId("exercise-my-answer")).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        expect(screen.getByTestId("exercise-solution")).toHaveAttribute(
            "aria-pressed",
            "false",
        );
        rerender(
            <ExerciseAnswerToggle
                view="solution"
                onShowMyAnswer={() => {}}
                onShowSolution={() => {}}
            />,
        );
        expect(screen.getByTestId("exercise-solution")).toHaveAttribute(
            "aria-pressed",
            "true",
        );
    });

    it("fires the handlers on click", () => {
        const onMy = vi.fn();
        const onSolution = vi.fn();
        render(
            <ExerciseAnswerToggle
                view="my-answer"
                onShowMyAnswer={onMy}
                onShowSolution={onSolution}
            />,
        );
        fireEvent.click(screen.getByTestId("exercise-solution"));
        expect(onSolution).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId("exercise-my-answer"));
        expect(onMy).toHaveBeenCalledTimes(1);
    });
});
