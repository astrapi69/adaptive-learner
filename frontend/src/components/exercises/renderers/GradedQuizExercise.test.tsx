/**
 * Tests for the ext:al-graded-quiz renderer (#1579, fourth adoption): a scored
 * question set. Multi-select MC (checkboxes, for partial credit), free_text,
 * points per question, an aggregate points score and pass/fail.
 *
 * The exercise SCORE (correct/total for XP) counts correct QUESTIONS; the
 * POINTS + pass/fail are the formal test grade shown in the result.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import GradedQuizExercise from "./GradedQuizExercise";
import type {ContentLessonExercise} from "../../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-gq-01",
    type: "ext:al-graded-quiz",
    prompt: "Beantworte alle Fragen. Bestanden ab 60%.",
    card_ids: [],
    distractors: [],
    ext_payload: {
        pass_threshold: 60,
        questions: [
            {prompt: "Was ist 2+2?", type: "multiple_choice", options: [{text: "4", correct: true}, {text: "5"}], points: 2},
            {prompt: "Synonym fuer schnell?", type: "free_text", accept: ["rasch"], points: 3},
            {
                prompt: "Welche sind Primzahlen?",
                type: "multiple_choice",
                options: [{text: "2", correct: true}, {text: "3", correct: true}, {text: "4"}],
                points: 4,
                partial_credit: true,
            },
        ],
    },
} as unknown as ContentLessonExercise;

const pick = (q: number, name: string) =>
    fireEvent.click(within(screen.getByTestId(`graded-quiz-question-${q}`)).getByRole("checkbox", {name}));
const typeIn = (q: number, value: string) =>
    fireEvent.change(screen.getByTestId(`graded-quiz-q${q}-input`), {target: {value}});
const submit = () => fireEvent.click(screen.getByTestId("graded-quiz-submit"));

describe("GradedQuizExercise: render", () => {
    it("renders prompt, questions with points, and inputs", () => {
        render(<GradedQuizExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("graded-quiz-prompt")).toHaveTextContent("Beantworte alle Fragen");
        expect(screen.getByTestId("graded-quiz-question-0")).toHaveTextContent("Was ist 2+2?");
        expect(screen.getByTestId("graded-quiz-question-0")).toHaveTextContent("2 P.");
        expect(screen.getByTestId("graded-quiz-q1-input")).toBeInTheDocument();
        expect(within(screen.getByTestId("graded-quiz-question-2")).getAllByRole("checkbox")).toHaveLength(3);
    });

    it("renders the empty state for a malformed payload", () => {
        const broken = {...EXERCISE, ext_payload: {questions: "x"}} as unknown as ContentLessonExercise;
        render(<GradedQuizExercise exercise={broken} onComplete={vi.fn()} />);
        expect(screen.getByTestId("graded-quiz-empty")).toBeInTheDocument();
    });
});

describe("GradedQuizExercise: checkability", () => {
    it("stays disabled until every question is answered", () => {
        render(<GradedQuizExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("graded-quiz-submit")).toBeDisabled();
        pick(0, "4");
        typeIn(1, "rasch");
        expect(screen.getByTestId("graded-quiz-submit")).toBeDisabled();
        pick(2, "2");
        expect(screen.getByTestId("graded-quiz-submit")).toBeEnabled();
    });
});

describe("GradedQuizExercise: submit lifecycle", () => {
    it("full marks: passes, reports points score + per-question SRS + raw_answer", () => {
        const onComplete = vi.fn();
        render(<GradedQuizExercise exercise={EXERCISE} setId="s" lessonId="l" onComplete={onComplete} />);
        pick(0, "4");
        typeIn(1, "rasch");
        pick(2, "2");
        pick(2, "3");
        submit();
        const scored = onComplete.mock.calls[0][0];
        // exercise score = correct QUESTIONS / questions (for XP)
        expect(scored.correct).toBe(3);
        expect(scored.total).toBe(3);
        expect(scored.attempts).toHaveLength(3);
        expect(scored.raw_answer).toEqual({kind: "al_graded_quiz", answers: [["4"], ["rasch"], ["2", "3"]]});
        // points + pass shown
        expect(screen.getByTestId("graded-quiz-score")).toHaveTextContent("9/9");
        expect(screen.getByTestId("graded-quiz-result")).toHaveAttribute("data-result", "passed");
    });

    it("partial credit: 7/9 points still passes, wrong question shows its solution", () => {
        const onComplete = vi.fn();
        render(<GradedQuizExercise exercise={EXERCISE} onComplete={onComplete} />);
        pick(0, "4");
        typeIn(1, "rasch");
        pick(2, "2"); // one of two correct -> 2 of 4 points, question not fully correct
        submit();
        const scored = onComplete.mock.calls[0][0];
        expect(scored.correct).toBe(2); // Q0 + Q1 correct, Q2 not
        expect(screen.getByTestId("graded-quiz-score")).toHaveTextContent("7/9");
        expect(screen.getByTestId("graded-quiz-result")).toHaveAttribute("data-result", "passed");
        expect(screen.getByTestId("graded-quiz-question-2")).toHaveAttribute("data-verdict", "wrong");
        expect(screen.getByTestId("graded-quiz-q2-solution")).toHaveTextContent("2, 3");
    });

    it("failing quiz: below threshold shows data-result failed", () => {
        const onComplete = vi.fn();
        render(<GradedQuizExercise exercise={EXERCISE} onComplete={onComplete} />);
        pick(0, "5");
        typeIn(1, "falsch");
        pick(2, "4");
        submit();
        expect(onComplete.mock.calls[0][0].correct).toBe(0);
        expect(screen.getByTestId("graded-quiz-score")).toHaveTextContent("0/9");
        expect(screen.getByTestId("graded-quiz-result")).toHaveAttribute("data-result", "failed");
    });

    it("retry clears answers and verdicts", () => {
        render(<GradedQuizExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        pick(0, "4");
        typeIn(1, "rasch");
        pick(2, "2");
        submit();
        fireEvent.click(screen.getByTestId("graded-quiz-retry"));
        expect(screen.getByTestId("graded-quiz-submit")).toBeDisabled();
        expect(screen.getByTestId("graded-quiz-q1-input")).toHaveValue("");
        expect(screen.getByTestId("graded-quiz-question-0")).not.toHaveAttribute("data-verdict");
    });
});

describe("GradedQuizExercise: reviewed (locked) reconstruction", () => {
    it("restores a failing attempt with the same score + verdicts as a fresh submit", () => {
        render(
            <GradedQuizExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                reviewed={{kind: "al_graded_quiz", answers: [["5"], ["falsch"], ["4"]]}}
            />,
        );
        expect(screen.getByTestId("graded-quiz-result")).toHaveAttribute("data-result", "failed");
        expect(screen.getByTestId("graded-quiz-score")).toHaveTextContent("0/9");
        expect(screen.getByTestId("graded-quiz-question-0")).toHaveAttribute("data-verdict", "wrong");
        expect(screen.getByTestId("graded-quiz-q1-input")).toHaveValue("falsch");
        expect(screen.queryByTestId("graded-quiz-submit")).not.toBeInTheDocument();
    });
});

describe("GradedQuizExercise: answer-position shuffle (#2317)", () => {
    const SHUFFLE_EXERCISE = {
        id: "ex-gq-shuffle",
        type: "ext:al-graded-quiz",
        prompt: "Q",
        card_ids: [],
        distractors: [],
        ext_payload: {
            pass_threshold: 50,
            questions: [
                {
                    prompt: "Pick A",
                    type: "multiple_choice",
                    options: [
                        {text: "A", correct: true},
                        {text: "B"},
                        {text: "C"},
                        {text: "D"},
                    ],
                    points: 1,
                },
            ],
        },
    } as unknown as ContentLessonExercise;

    function correctOptionPosition(id: string): number {
        const {unmount} = render(
            <GradedQuizExercise
                exercise={{...SHUFFLE_EXERCISE, id}}
                onComplete={vi.fn()}
            />,
        );
        const block = screen.getByTestId("graded-quiz-question-0");
        const labels = Array.from(block.querySelectorAll("label"));
        const pos = labels.findIndex((l) => l.textContent?.trim() === "A");
        unmount();
        return pos;
    }

    it("does not place the correct option at a fixed display position across exercises", () => {
        const positions = new Set<number>();
        for (let i = 0; i < 40; i++) {
            positions.add(correctOptionPosition(`ex-gq-${i}`));
        }
        expect(positions.size).toBeGreaterThan(1);
    });

    it("grades by option text regardless of display order", () => {
        const onComplete = vi.fn();
        render(
            <GradedQuizExercise
                exercise={{...SHUFFLE_EXERCISE, id: "ex-gq-grade"}}
                onComplete={onComplete}
            />,
        );
        fireEvent.click(
            within(screen.getByTestId("graded-quiz-question-0")).getByRole(
                "checkbox",
                {name: "A"},
            ),
        );
        fireEvent.click(screen.getByTestId("graded-quiz-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1}),
        );
    });
});
