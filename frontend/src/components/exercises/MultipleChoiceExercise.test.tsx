/**
 * Tests for the MultipleChoiceExercise component (#890 / schema v1.5).
 *
 * Pins the single- vs multi-select behaviour, exact-set scoring, the
 * post-check resolution, and the reviewed (locked-revisit) path. No
 * backend / asset mocking is needed — rendering + grading are fully
 * client-side, so the same behaviour holds in API and Dexie mode.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import MultipleChoiceExercise from "./MultipleChoiceExercise";
import type {ContentLessonExercise} from "../../storage/types";

const SINGLE: ContentLessonExercise = {
    id: "ex-mc",
    type: "multiple_choice",
    prompt: "What is the capital of France?",
    card_ids: [],
    options: ["Berlin", "Paris", "Madrid"],
    correct_options: [1],
    distractors: [],
};

const MULTI: ContentLessonExercise = {
    id: "ex-mc-multi",
    type: "multiple_choice",
    prompt: "Which of these are prime numbers?",
    card_ids: [],
    options: ["2", "4", "5", "9"],
    correct_options: [0, 2],
    distractors: [],
};

describe("MultipleChoiceExercise: render", () => {
    it("renders the prompt + every option", () => {
        render(<MultipleChoiceExercise exercise={SINGLE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("multiple-choice-prompt")).toHaveTextContent(
            "capital of France",
        );
        for (let i = 0; i < 3; i++) {
            expect(
                screen.getByTestId(`multiple-choice-option-${i}`),
            ).toBeInTheDocument();
        }
    });

    it("single-correct => single-select (radio role, not multi)", () => {
        render(<MultipleChoiceExercise exercise={SINGLE} onComplete={vi.fn()} />);
        expect(
            screen.getByTestId("multiple-choice-exercise"),
        ).toHaveAttribute("data-multiselect", "false");
        expect(screen.getByTestId("multiple-choice-option-0")).toHaveAttribute(
            "role",
            "radio",
        );
    });

    it("two-or-more correct => multi-select (checkbox role)", () => {
        render(<MultipleChoiceExercise exercise={MULTI} onComplete={vi.fn()} />);
        expect(
            screen.getByTestId("multiple-choice-exercise"),
        ).toHaveAttribute("data-multiselect", "true");
        expect(screen.getByTestId("multiple-choice-option-0")).toHaveAttribute(
            "role",
            "checkbox",
        );
    });

    it("submit is disabled until an option is selected", () => {
        render(<MultipleChoiceExercise exercise={SINGLE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("multiple-choice-submit")).toBeDisabled();
        fireEvent.click(screen.getByTestId("multiple-choice-option-0"));
        expect(
            screen.getByTestId("multiple-choice-submit"),
        ).not.toBeDisabled();
    });
});

describe("MultipleChoiceExercise: single-select scoring", () => {
    it("reports correct=1 on the right pick", () => {
        const onComplete = vi.fn();
        render(
            <MultipleChoiceExercise exercise={SINGLE} onComplete={onComplete} />,
        );
        fireEvent.click(screen.getByTestId("multiple-choice-option-1"));
        fireEvent.click(screen.getByTestId("multiple-choice-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1}),
        );
        expect(screen.getByTestId("multiple-choice-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });

    it("reports correct=0 on a wrong pick + reveals the right answer", () => {
        const onComplete = vi.fn();
        render(
            <MultipleChoiceExercise exercise={SINGLE} onComplete={onComplete} />,
        );
        fireEvent.click(screen.getByTestId("multiple-choice-option-0"));
        fireEvent.click(screen.getByTestId("multiple-choice-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
        expect(screen.getByTestId("multiple-choice-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
        // The correct option is highlighted after submit so the user sees
        // the right answer (not colour alone — it carries is-correct + a
        // check badge).
        expect(
            screen.getByTestId("multiple-choice-option-1").className,
        ).toMatch(/is-correct/);
    });

    it("a new pick replaces the prior single-select choice", () => {
        const onComplete = vi.fn();
        render(
            <MultipleChoiceExercise exercise={SINGLE} onComplete={onComplete} />,
        );
        fireEvent.click(screen.getByTestId("multiple-choice-option-0"));
        fireEvent.click(screen.getByTestId("multiple-choice-option-1"));
        fireEvent.click(screen.getByTestId("multiple-choice-submit"));
        // Only option 1 stays selected => correct.
        const [[scored]] = onComplete.mock.calls;
        expect(scored.raw_answer).toEqual({
            kind: "multiple_choice",
            selected: [1],
        });
        expect(scored.correct).toBe(1);
    });
});

describe("MultipleChoiceExercise: multi-select scoring", () => {
    it("correct only when the selected set equals the correct set exactly", () => {
        const onComplete = vi.fn();
        render(
            <MultipleChoiceExercise exercise={MULTI} onComplete={onComplete} />,
        );
        fireEvent.click(screen.getByTestId("multiple-choice-option-0")); // 2 (prime)
        fireEvent.click(screen.getByTestId("multiple-choice-option-2")); // 5 (prime)
        fireEvent.click(screen.getByTestId("multiple-choice-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1}),
        );
    });

    it("a missing correct option scores 0 (partial selection is wrong)", () => {
        const onComplete = vi.fn();
        render(
            <MultipleChoiceExercise exercise={MULTI} onComplete={onComplete} />,
        );
        fireEvent.click(screen.getByTestId("multiple-choice-option-0")); // only one of two
        fireEvent.click(screen.getByTestId("multiple-choice-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
    });

    it("an extra wrong option scores 0", () => {
        const onComplete = vi.fn();
        render(
            <MultipleChoiceExercise exercise={MULTI} onComplete={onComplete} />,
        );
        fireEvent.click(screen.getByTestId("multiple-choice-option-0")); // 2 ✓
        fireEvent.click(screen.getByTestId("multiple-choice-option-2")); // 5 ✓
        fireEvent.click(screen.getByTestId("multiple-choice-option-3")); // 9 ✗ (extra)
        fireEvent.click(screen.getByTestId("multiple-choice-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
    });

    it("clicking a selected option toggles it off in multi-select", () => {
        render(<MultipleChoiceExercise exercise={MULTI} onComplete={vi.fn()} />);
        const opt = screen.getByTestId("multiple-choice-option-0");
        fireEvent.click(opt);
        expect(opt).toHaveAttribute("data-selected", "true");
        fireEvent.click(opt);
        expect(opt).toHaveAttribute("data-selected", "false");
    });
});

describe("MultipleChoiceExercise: lifecycle", () => {
    it("'Try again' resets the selection and re-disables submit", () => {
        render(<MultipleChoiceExercise exercise={SINGLE} onComplete={vi.fn()} />);
        fireEvent.click(screen.getByTestId("multiple-choice-option-0"));
        fireEvent.click(screen.getByTestId("multiple-choice-submit"));
        fireEvent.click(screen.getByTestId("multiple-choice-retry"));
        expect(screen.getByTestId("multiple-choice-submit")).toBeDisabled();
    });

    it("a reviewed answer re-mounts locked in the post-check state", () => {
        render(
            <MultipleChoiceExercise
                exercise={SINGLE}
                onComplete={vi.fn()}
                reviewed={{kind: "multiple_choice", selected: [1]}}
            />,
        );
        // Locked: options disabled, result shown as correct.
        expect(screen.getByTestId("multiple-choice-option-0")).toBeDisabled();
        expect(screen.getByTestId("multiple-choice-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });

    it("renders the empty state when options are missing", () => {
        render(
            <MultipleChoiceExercise
                exercise={{...SINGLE, options: undefined}}
                onComplete={vi.fn()}
            />,
        );
        expect(
            screen.getByTestId("multiple-choice-empty"),
        ).toBeInTheDocument();
    });
});
