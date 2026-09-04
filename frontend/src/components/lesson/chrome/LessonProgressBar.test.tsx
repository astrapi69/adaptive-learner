/**
 * Tests for LessonProgressBar (#2874): the game-mode checkpoint
 * dots render only in playful mode, mark their reached state, and
 * stay away from the summary and from tiny lessons.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import LessonProgressBar from "./LessonProgressBar";
import {subscribeCelebration} from "../../../lib/praise/celebration-bus";
import {vi} from "vitest";

const base = {isSummary: false, currentStepIndex: 0, totalSteps: 9};

describe("LessonProgressBar checkpoints", () => {
    it("renders no dots outside game mode", () => {
        render(<LessonProgressBar {...base} />);
        expect(
            screen.queryByTestId("lesson-checkpoint-33"),
        ).not.toBeInTheDocument();
    });

    it("renders both dots in game mode and marks reached ones", () => {
        render(
            <LessonProgressBar {...base} playful currentStepIndex={4} />,
        );
        expect(screen.getByTestId("lesson-checkpoint-33")).toHaveAttribute(
            "data-reached",
            "true",
        );
        expect(screen.getByTestId("lesson-checkpoint-67")).toHaveAttribute(
            "data-reached",
            "false",
        );
    });

    it("renders no dots on the summary or for tiny lessons", () => {
        render(<LessonProgressBar {...base} playful isSummary />);
        expect(
            screen.queryByTestId("lesson-checkpoint-33"),
        ).not.toBeInTheDocument();
        render(
            <LessonProgressBar {...base} playful totalSteps={2} />,
        );
        expect(
            screen.queryByTestId("lesson-checkpoint-33"),
        ).not.toBeInTheDocument();
    });
});

describe("checkpoint celebration event (#2875)", () => {
    it("emits once when the fill crosses a checkpoint, not on re-render or backwards", () => {
        const seen = vi.fn();
        const unsub = subscribeCelebration((e) => {
            if (e.type === "checkpoint") seen();
        });
        const {rerender} = render(
            <LessonProgressBar {...base} playful currentStepIndex={2} />,
        );
        expect(seen).not.toHaveBeenCalled();
        rerender(
            <LessonProgressBar {...base} playful currentStepIndex={4} />,
        );
        expect(seen).toHaveBeenCalledTimes(1);
        rerender(
            <LessonProgressBar {...base} playful currentStepIndex={4} />,
        );
        expect(seen).toHaveBeenCalledTimes(1);
        rerender(
            <LessonProgressBar {...base} playful currentStepIndex={2} />,
        );
        rerender(
            <LessonProgressBar {...base} playful currentStepIndex={7} />,
        );
        // Jumping past both dots in one navigation celebrates once -
        // one crossing event, not one event per dot.
        expect(seen).toHaveBeenCalledTimes(2);
        unsub();
    });
});
