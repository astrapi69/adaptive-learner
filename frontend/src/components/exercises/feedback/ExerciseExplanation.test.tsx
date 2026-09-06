/**
 * Tests for ExerciseExplanation (#2991) - the authored post-answer "why".
 *
 * Pins the fold state per outcome (expanded on wrong, collapsed on correct
 * and on a revisit), the two gates (review preference, exam mode), the
 * Markdown rendering, and the 2000-char schema ceiling.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it} from "vitest";

import ExerciseExplanation from "./ExerciseExplanation";
import {LessonModeProvider} from "../../../hooks/lesson/modes/useLessonMode";
import {setExplanationsEnabled} from "../../../lib/review/reviewPref";

const EXPLANATION = [
    "**Rule:** descriptive adjectives follow the noun.",
    "",
    "**Word for word:**",
    "- *el* - the (article)",
    "- *coche* - car (noun)",
    "- *rojo* - red (adjective, after the noun)",
].join("\n");

beforeEach(() => {
    localStorage.clear();
});

describe("ExerciseExplanation", () => {
    it("reproduction: an authored explanation is rendered after a wrong answer", () => {
        render(<ExerciseExplanation explanation={EXPLANATION} outcome="incorrect" />);
        const section = screen.getByTestId("exercise-explanation");
        expect(section).toHaveAttribute("data-state", "open");
        expect(section).toHaveAttribute("data-outcome", "incorrect");
        const body = screen.getByTestId("exercise-explanation-body");
        expect(body.querySelector("strong")).toHaveTextContent("Rule:");
        expect(body.querySelectorAll("li")).toHaveLength(3);
        expect(body.querySelector("em")).toHaveTextContent("el");
    });

    it("collapses behind the toggle after a correct answer and opens on click", () => {
        render(<ExerciseExplanation explanation={EXPLANATION} outcome="correct" />);
        expect(screen.getByTestId("exercise-explanation")).toHaveAttribute(
            "data-state",
            "collapsed",
        );
        expect(screen.queryByTestId("exercise-explanation-body")).toBeNull();
        const toggle = screen.getByTestId("exercise-explanation-toggle");
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(toggle);
        expect(screen.getByTestId("exercise-explanation-body")).toBeInTheDocument();
        expect(toggle).toHaveAttribute("aria-expanded", "true");
    });

    it("collapses on a revisited step", () => {
        render(<ExerciseExplanation explanation={EXPLANATION} outcome="reviewed" />);
        expect(screen.getByTestId("exercise-explanation")).toHaveAttribute(
            "data-state",
            "collapsed",
        );
    });

    it("re-evaluates the fold when the outcome changes", () => {
        const {rerender} = render(
            <ExerciseExplanation explanation={EXPLANATION} outcome={null} />,
        );
        expect(screen.queryByTestId("exercise-explanation")).toBeNull();
        rerender(<ExerciseExplanation explanation={EXPLANATION} outcome="incorrect" />);
        expect(screen.getByTestId("exercise-explanation")).toHaveAttribute(
            "data-state",
            "open",
        );
    });

    it.each([
        ["no explanation", null, "incorrect"],
        ["blank explanation", "   \n", "incorrect"],
        ["unanswered", EXPLANATION, null],
    ] as const)("renders nothing with %s", (_label, explanation, outcome) => {
        render(<ExerciseExplanation explanation={explanation} outcome={outcome} />);
        expect(screen.queryByTestId("exercise-explanation")).toBeNull();
    });

    it("is gated by the review preference, live", () => {
        render(<ExerciseExplanation explanation={EXPLANATION} outcome="incorrect" />);
        expect(screen.getByTestId("exercise-explanation")).toBeInTheDocument();
        act(() => setExplanationsEnabled(false));
        expect(screen.queryByTestId("exercise-explanation")).toBeNull();
        act(() => setExplanationsEnabled(true));
        expect(screen.getByTestId("exercise-explanation")).toBeInTheDocument();
    });

    it("hides in exam mode (no immediate feedback)", () => {
        render(
            <LessonModeProvider mode="exam">
                <ExerciseExplanation explanation={EXPLANATION} outcome="incorrect" />
            </LessonModeProvider>,
        );
        expect(screen.queryByTestId("exercise-explanation")).toBeNull();
    });

    it("boundary: renders a 2000-char explanation (the schema ceiling)", () => {
        const long = "x".repeat(2000);
        render(<ExerciseExplanation explanation={long} outcome="incorrect" />);
        expect(screen.getByTestId("exercise-explanation-body")).toHaveTextContent(long);
    });
});
