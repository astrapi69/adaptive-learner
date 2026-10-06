/**
 * #3575 - in the detailed view the answers overview marks each mistake of
 * the run as corrected or still open, so the overview is the complete
 * record of the lesson including its corrections.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import LessonAnswersDetail from "./LessonAnswersDetail";
import type {ExerciseBreakdownEntry} from "../../../lib/lesson/lesson-summary";

function entry(stepId: string, fullyCorrect: boolean): ExerciseBreakdownEntry {
    return {
        stepId,
        title: `Exercise ${stepId}`,
        exerciseType: "free_text",
        attempted: true,
        correct: fullyCorrect ? 1 : 0,
        total: 1,
        fullyCorrect,
        canonicalAnswer: "hola",
        userAnswer: fullyCorrect ? "hola" : "ola",
        question: `Translate ${stepId}`,
    };
}

const BREAKDOWN = [entry("s1", false), entry("s2", false), entry("s3", true)];

describe("LessonAnswersDetail correction marks (#3575)", () => {
    it.each([
        ["corrected", "s1", "true", "Corrected"],
        ["still open", "s2", "false", "Still open"],
    ])("marks a %s mistake", (_name, stepId, flag, label) => {
        render(
            <LessonAnswersDetail
                breakdown={BREAKDOWN}
                correction={new Map([["s1", true], ["s2", false]])}
            />,
        );
        const mark = screen.getByTestId(`lesson-summary-breakdown-correction-${stepId}`);
        expect(mark).toHaveAttribute("data-corrected", flag);
        expect(mark).toHaveTextContent(label);
    });

    it("leaves a row the run got right unmarked", () => {
        render(
            <LessonAnswersDetail
                breakdown={BREAKDOWN}
                correction={new Map([["s1", true], ["s2", false]])}
            />,
        );
        expect(screen.queryByTestId("lesson-summary-breakdown-correction-s3")).toBeNull();
    });

    it("marks nothing without correction data (the compact view)", () => {
        render(<LessonAnswersDetail breakdown={BREAKDOWN} />);
        expect(screen.queryByTestId("lesson-summary-breakdown-correction-s1")).toBeNull();
        expect(screen.queryByTestId("lesson-summary-breakdown-correction-s2")).toBeNull();
    });
});
