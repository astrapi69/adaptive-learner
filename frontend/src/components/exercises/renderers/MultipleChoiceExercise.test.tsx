/**
 * Tests for the native multiple_choice renderer (#1525, schema v1.6).
 *
 * Pins the radio-vs-checkbox mode split, single-pick radio semantics,
 * exact-set scoring in multi mode (no partial credit), the per-option
 * resolution verdicts, the raw_answer + single SRS attempt, and the
 * coexistence guarantee (renders independently of the cloze paths).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import MultipleChoiceExercise from "./MultipleChoiceExercise";
import type {ContentLessonExercise} from "../../../storage/types";

const SINGLE: ContentLessonExercise = {
    id: "ex-mc-single",
    type: "multiple_choice",
    prompt: "Wer hat an einer Kreuzung ohne Zeichen Vorfahrt?",
    card_ids: [],
    distractors: [],
    options: [
        {text: "Wer von rechts kommt", correct: true},
        {text: "Wer von links kommt"},
        {text: "Das groessere Fahrzeug"},
    ],
};

const MULTI: ContentLessonExercise = {
    id: "ex-mc-multi",
    type: "multiple_choice",
    multiple: true,
    prompt: "Welche dieser Zahlen sind Primzahlen?",
    card_ids: [],
    distractors: [],
    options: [
        {text: "2", correct: true},
        {text: "3", correct: true},
        {text: "4"},
    ],
};

const input = (name: string) =>
    screen.getByLabelText(name) as HTMLInputElement;

const check = () => fireEvent.click(screen.getByTestId("multiple-choice-submit"));

describe("MultipleChoiceExercise: single mode (radio)", () => {
    it("renders one radio per option and marks the mode", () => {
        render(<MultipleChoiceExercise exercise={SINGLE} onComplete={vi.fn()} />);
        expect(screen.getAllByRole("radio")).toHaveLength(3);
        expect(screen.getByTestId("multiple-choice-exercise")).toHaveAttribute(
            "data-multiple",
            "false",
        );
        expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    it("radio semantics: picking a second option replaces the first", () => {
        render(<MultipleChoiceExercise exercise={SINGLE} onComplete={vi.fn()} />);
        fireEvent.click(input("Wer von links kommt"));
        fireEvent.click(input("Wer von rechts kommt"));
        expect(input("Wer von rechts kommt").checked).toBe(true);
        expect(input("Wer von links kommt").checked).toBe(false);
    });

    it("grades the correct pick 1/1 and emits raw_answer + one attempt", () => {
        const onComplete = vi.fn();
        render(
            <MultipleChoiceExercise exercise={SINGLE} onComplete={onComplete} />,
        );
        fireEvent.click(input("Wer von rechts kommt"));
        check();
        expect(onComplete).toHaveBeenCalledTimes(1);
        const scored = onComplete.mock.calls[0][0];
        expect(scored.correct).toBe(1);
        expect(scored.total).toBe(1);
        expect(scored.raw_answer).toEqual({
            kind: "multiple_choice",
            selected: ["Wer von rechts kommt"],
        });
        expect(scored.attempts).toHaveLength(1);
        expect(scored.attempts[0].correct).toBe(true);
        expect(scored.attempts[0].correct_answer).toBe("Wer von rechts kommt");
    });

    it("grades a wrong pick 0/1 and shows verdicts (wrong + missed)", () => {
        const onComplete = vi.fn();
        render(
            <MultipleChoiceExercise exercise={SINGLE} onComplete={onComplete} />,
        );
        fireEvent.click(input("Wer von links kommt"));
        check();
        expect(onComplete.mock.calls[0][0].correct).toBe(0);
        expect(
            input("Wer von links kommt").closest("label"),
        ).toHaveAttribute("data-verdict", "wrong");
        expect(
            input("Wer von rechts kommt").closest("label"),
        ).toHaveAttribute("data-verdict", "missed");
    });
});

describe("MultipleChoiceExercise: multi mode (checkboxes, exact set)", () => {
    it("renders checkboxes and marks the mode", () => {
        render(<MultipleChoiceExercise exercise={MULTI} onComplete={vi.fn()} />);
        expect(screen.getAllByRole("checkbox")).toHaveLength(3);
        expect(screen.getByTestId("multiple-choice-exercise")).toHaveAttribute(
            "data-multiple",
            "true",
        );
    });

    it("accepts the exact correct set", () => {
        const onComplete = vi.fn();
        render(
            <MultipleChoiceExercise exercise={MULTI} onComplete={onComplete} />,
        );
        fireEvent.click(input("2"));
        fireEvent.click(input("3"));
        check();
        expect(onComplete.mock.calls[0][0].correct).toBe(1);
    });

    it("rejects a partial selection - no partial credit", () => {
        const onComplete = vi.fn();
        render(
            <MultipleChoiceExercise exercise={MULTI} onComplete={onComplete} />,
        );
        fireEvent.click(input("2"));
        check();
        const scored = onComplete.mock.calls[0][0];
        expect(scored.correct).toBe(0);
        expect(scored.total).toBe(1);
    });

    it("rejects a superset (wrong option added) and marks it wrong", () => {
        const onComplete = vi.fn();
        render(
            <MultipleChoiceExercise exercise={MULTI} onComplete={onComplete} />,
        );
        fireEvent.click(input("2"));
        fireEvent.click(input("3"));
        fireEvent.click(input("4"));
        check();
        expect(onComplete.mock.calls[0][0].correct).toBe(0);
        expect(input("4").closest("label")).toHaveAttribute(
            "data-verdict",
            "wrong",
        );
    });
});

describe("MultipleChoiceExercise: guards", () => {
    it("check stays disabled until something is selected", () => {
        render(<MultipleChoiceExercise exercise={SINGLE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("multiple-choice-submit")).toBeDisabled();
    });

    it("renders the empty-state notice when options are absent", () => {
        const broken: ContentLessonExercise = {...SINGLE, options: []};
        render(<MultipleChoiceExercise exercise={broken} onComplete={vi.fn()} />);
        expect(screen.getByTestId("multiple-choice-empty")).toBeInTheDocument();
    });
});
