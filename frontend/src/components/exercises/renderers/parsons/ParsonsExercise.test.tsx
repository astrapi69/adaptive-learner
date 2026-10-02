/**
 * Tests for the ParsonsExercise renderer (#3110, ``ext:al-parsons``).
 *
 * Pins the tap-to-place + per-tile indent stepper UX and the "order AND
 * indentation" scoring contract:
 * - Initial render: prompt + scrambled bar + empty answer placeholder.
 * - Tap a scrambled line → moves to the answer row at indent 0.
 * - The indent stepper increments/decrements a placed tile's indent.
 * - Submit disabled until every line is placed.
 * - Correct order + correct indents → {correct: 1, total: 1}.
 * - Correct order, wrong indent → {correct: 0, total: 1} ("right sequence
 *   at the wrong depth is wrong").
 * - Wrong order → {correct: 0, total: 1}.
 * - Try-again resets placement AND indents.
 * - reviewed reconstruction restores order + indents, locked.
 * - Malformed payload surfaces the empty-state testid.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import ParsonsExercise from "./ParsonsExercise";
import type {ContentLessonExercise} from "../../../../storage/types";
import {PARSONS_EXT_TYPE} from "../../../../lib/exercises/payload/parsons";

const EXERCISE: ContentLessonExercise = {
    id: "ex-parsons",
    type: PARSONS_EXT_TYPE,
    prompt: "Arrange the function body.",
    card_ids: [],
    distractors: [],
    ext_payload: {
        language: "python",
        lines: [
            {code: "def greet(name):", indent: 0},
            {code: "if name:", indent: 1},
            {code: "print(name)", indent: 2},
        ],
    },
};

function placeAllInOrder() {
    fireEvent.click(screen.getByTestId("parsons-scrambled-0"));
    fireEvent.click(screen.getByTestId("parsons-scrambled-1"));
    fireEvent.click(screen.getByTestId("parsons-scrambled-2"));
}

function incIndent(slot: number, times: number) {
    for (let i = 0; i < times; i++) {
        fireEvent.click(screen.getByTestId(`parsons-indent-inc-${slot}`));
    }
}

describe("ParsonsExercise: initial render", () => {
    it("renders the prompt and an empty-answer placeholder", () => {
        render(<ParsonsExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("parsons-prompt")).toHaveTextContent(
            "Arrange the function body.",
        );
        expect(screen.getByTestId("parsons-answer-empty")).toBeInTheDocument();
    });

    it("renders one scrambled tile button per line", () => {
        render(<ParsonsExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("parsons-scrambled-0")).toBeInTheDocument();
        expect(screen.getByTestId("parsons-scrambled-1")).toBeInTheDocument();
        expect(screen.getByTestId("parsons-scrambled-2")).toBeInTheDocument();
    });

    it("surfaces the empty-state testid for a malformed payload", () => {
        const broken: ContentLessonExercise = {...EXERCISE, ext_payload: {lines: "nope"}};
        render(<ParsonsExercise exercise={broken} onComplete={vi.fn()} />);
        expect(screen.getByTestId("parsons-empty")).toBeInTheDocument();
    });
});

describe("ParsonsExercise: placement, indent, and scoring", () => {
    it("disables submit until every line is placed", () => {
        render(<ParsonsExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("parsons-submit")).toBeDisabled();
        placeAllInOrder();
        expect(screen.getByTestId("parsons-submit")).toBeEnabled();
    });

    it("a fresh placed tile starts at indent 0", () => {
        render(<ParsonsExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        fireEvent.click(screen.getByTestId("parsons-scrambled-0"));
        expect(screen.getByTestId("parsons-indent-0")).toHaveTextContent("0");
    });

    it("the indent stepper increments and decrements", () => {
        render(<ParsonsExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        fireEvent.click(screen.getByTestId("parsons-scrambled-0"));
        incIndent(0, 2);
        expect(screen.getByTestId("parsons-indent-0")).toHaveTextContent("2");
        fireEvent.click(screen.getByTestId("parsons-indent-dec-0"));
        expect(screen.getByTestId("parsons-indent-0")).toHaveTextContent("1");
    });

    it("reports {correct: 1, total: 1} for the right order at the right indents", () => {
        const onComplete = vi.fn();
        render(<ParsonsExercise exercise={EXERCISE} onComplete={onComplete} />);
        placeAllInOrder();
        incIndent(1, 1);
        incIndent(2, 2);
        fireEvent.click(screen.getByTestId("parsons-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({
                correct: 1,
                total: 1,
                raw_answer: {kind: "al_parsons", placed: [0, 1, 2], indents: [0, 1, 2]},
            }),
        );
        expect(screen.getByTestId("parsons-result")).toHaveAttribute("data-result", "correct");
    });

    it("reports {correct: 0, total: 1} for the right order at the WRONG indent", () => {
        const onComplete = vi.fn();
        render(<ParsonsExercise exercise={EXERCISE} onComplete={onComplete} />);
        placeAllInOrder();
        // Leave every indent at 0 — order is right, depth is wrong for lines 1+2.
        fireEvent.click(screen.getByTestId("parsons-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
        expect(screen.getByTestId("parsons-result")).toHaveAttribute("data-result", "wrong");
    });

    it("reports {correct: 0, total: 1} for the wrong order", () => {
        const onComplete = vi.fn();
        render(<ParsonsExercise exercise={EXERCISE} onComplete={onComplete} />);
        fireEvent.click(screen.getByTestId("parsons-scrambled-1"));
        fireEvent.click(screen.getByTestId("parsons-scrambled-0"));
        fireEvent.click(screen.getByTestId("parsons-scrambled-2"));
        fireEvent.click(screen.getByTestId("parsons-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
    });

    it("try-again resets placement and indents", () => {
        render(<ParsonsExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        placeAllInOrder();
        incIndent(1, 1);
        fireEvent.click(screen.getByTestId("parsons-submit"));
        fireEvent.click(screen.getByTestId("parsons-retry"));
        expect(screen.getByTestId("parsons-answer-empty")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("parsons-scrambled-1"));
        expect(screen.getByTestId("parsons-indent-0")).toHaveTextContent("0");
    });
});

describe("ParsonsExercise: post-check diagnosis (#3218)", () => {
    it("marks each wrong line and shows the solution after a wrong answer", () => {
        render(<ParsonsExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        placeAllInOrder();
        incIndent(1, 1);
        fireEvent.click(screen.getByTestId("parsons-submit"));
        expect(screen.getByTestId("parsons-review-line-0")).toHaveAttribute(
            "data-status",
            "correct",
        );
        expect(screen.getByTestId("parsons-review-line-1")).toHaveAttribute(
            "data-status",
            "correct",
        );
        expect(screen.getByTestId("parsons-review-line-2")).toHaveAttribute(
            "data-status",
            "wrong_indent",
        );
        expect(screen.getByTestId("parsons-review-line-2")).toHaveTextContent("print(name)");
        expect(screen.getByTestId("parsons-solution")).toHaveTextContent("if name:");
    });

    it("marks swapped lines as wrong position", () => {
        render(<ParsonsExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        fireEvent.click(screen.getByTestId("parsons-scrambled-1"));
        fireEvent.click(screen.getByTestId("parsons-scrambled-0"));
        fireEvent.click(screen.getByTestId("parsons-scrambled-2"));
        fireEvent.click(screen.getByTestId("parsons-submit"));
        expect(screen.getByTestId("parsons-review-line-0")).toHaveAttribute(
            "data-status",
            "wrong_position",
        );
    });

    it("shows the answer but no solution block after a correct answer", () => {
        render(<ParsonsExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        placeAllInOrder();
        incIndent(1, 1);
        incIndent(2, 2);
        fireEvent.click(screen.getByTestId("parsons-submit"));
        expect(screen.getByTestId("parsons-review")).toBeInTheDocument();
        expect(screen.queryByTestId("parsons-solution")).not.toBeInTheDocument();
    });

    it("renders no diagnosis before checking", () => {
        render(<ParsonsExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.queryByTestId("parsons-review")).not.toBeInTheDocument();
    });
});

describe("ParsonsExercise: reviewed (revisited, locked) reconstruction", () => {
    it("restores the exact placed order + indents and shows the locked result", () => {
        render(
            <ParsonsExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                reviewed={{kind: "al_parsons", placed: [0, 1, 2], indents: [0, 1, 2]}}
            />,
        );
        expect(screen.getByTestId("parsons-result")).toHaveAttribute("data-result", "correct");
        expect(screen.queryByTestId("parsons-scrambled-row")).not.toBeInTheDocument();
    });
});
