/**
 * Tests for the ext:al-reading-comprehension renderer (#1579, third
 * adoption): a shared passage bound to N sub-questions that reuse the core
 * multiple_choice / free_text shapes.
 *
 * Pins passage + per-question rendering, the all-answered checkability gate,
 * per-question grading (MC exact, free_text via the shared matcher), the
 * aggregate score + SRS fan-out + raw_answer, the per-question solution after
 * a wrong attempt, retry, and the reviewed (locked) reconstruction.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import ReadingComprehensionExercise from "./ReadingComprehensionExercise";
import type {ContentLessonExercise} from "../../../storage/types";

const PASSAGE = "Rex lief in den Garten und bellte den Briefträger an.";

const EXERCISE: ContentLessonExercise = {
    id: "ex-rc-01",
    type: "ext:al-reading-comprehension",
    prompt: "Lies den Text und beantworte die Fragen.",
    card_ids: [],
    distractors: [],
    ext_payload: {
        passage: PASSAGE,
        questions: [
            {
                prompt: "Wohin lief Rex?",
                type: "multiple_choice",
                options: [
                    {text: "In den Garten", correct: true},
                    {text: "Auf die Straße"},
                ],
            },
            {prompt: "Wie hieß der Hund?", type: "free_text", accept: ["Rex"]},
        ],
    },
} as unknown as ContentLessonExercise;

const pickOption = (questionIndex: number, name: string) =>
    fireEvent.click(
        within(screen.getByTestId(`reading-comprehension-question-${questionIndex}`)).getByRole(
            "button",
            {name},
        ),
    );

const typeAnswer = (questionIndex: number, value: string) =>
    fireEvent.change(screen.getByTestId(`reading-comprehension-q${questionIndex}-input`), {
        target: {value},
    });

const submit = () => fireEvent.click(screen.getByTestId("reading-comprehension-submit"));

describe("ReadingComprehensionExercise: render", () => {
    it("renders prompt, passage, and one control block per question", () => {
        render(<ReadingComprehensionExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("reading-comprehension-prompt")).toHaveTextContent(
            "Lies den Text",
        );
        expect(screen.getByTestId("reading-comprehension-passage")).toHaveTextContent(
            "Rex lief in den Garten",
        );
        expect(screen.getByTestId("reading-comprehension-question-0")).toHaveTextContent(
            "Wohin lief Rex?",
        );
        expect(
            screen.getByTestId("reading-comprehension-q1-input"),
        ).toBeInTheDocument();
    });

    it("renders the empty state for a malformed payload", () => {
        const broken = {
            ...EXERCISE,
            ext_payload: {passage: PASSAGE},
        } as unknown as ContentLessonExercise;
        render(<ReadingComprehensionExercise exercise={broken} onComplete={vi.fn()} />);
        expect(screen.getByTestId("reading-comprehension-empty")).toBeInTheDocument();
    });
});

describe("ReadingComprehensionExercise: checkability gate", () => {
    it("stays disabled until every question is answered", () => {
        render(<ReadingComprehensionExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("reading-comprehension-submit")).toBeDisabled();
        pickOption(0, "In den Garten");
        expect(screen.getByTestId("reading-comprehension-submit")).toBeDisabled();
        typeAnswer(1, "Rex");
        expect(screen.getByTestId("reading-comprehension-submit")).toBeEnabled();
    });
});

describe("ReadingComprehensionExercise: submit lifecycle", () => {
    it("scores per question and reports the SRS fan-out + raw_answer", () => {
        const onComplete = vi.fn();
        render(
            <ReadingComprehensionExercise
                exercise={EXERCISE}
                setId="set-1"
                lessonId="lesson-1"
                onComplete={onComplete}
            />,
        );
        pickOption(0, "In den Garten");
        typeAnswer(1, "rex"); // tolerant match via the shared matcher
        submit();
        const scored = onComplete.mock.calls[0][0];
        expect(scored.correct).toBe(2);
        expect(scored.total).toBe(2);
        expect(scored.attempts).toHaveLength(2);
        expect(scored.attempts[0]).toMatchObject({exercise_id: "ex-rc-01", element_key: "In den Garten"});
        expect(scored.raw_answer).toEqual({
            kind: "al_reading_comprehension",
            answers: ["In den Garten", "rex"],
        });
        expect(screen.getByTestId("reading-comprehension-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });

    it("a wrong sub-question scores 1/2, marks it wrong and shows its canonical solution", () => {
        const onComplete = vi.fn();
        render(<ReadingComprehensionExercise exercise={EXERCISE} onComplete={onComplete} />);
        pickOption(0, "Auf die Straße"); // wrong
        typeAnswer(1, "Rex"); // right
        submit();
        const scored = onComplete.mock.calls[0][0];
        expect(scored.correct).toBe(1);
        expect(scored.total).toBe(2);
        expect(screen.getByTestId("reading-comprehension-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
        expect(screen.getByTestId("reading-comprehension-question-0")).toHaveAttribute(
            "data-verdict",
            "wrong",
        );
        expect(screen.getByTestId("reading-comprehension-q0-solution")).toHaveTextContent(
            "In den Garten",
        );
        expect(screen.getByTestId("reading-comprehension-question-1")).toHaveAttribute(
            "data-verdict",
            "correct",
        );
    });

    it("retry clears every answer and verdict", () => {
        render(<ReadingComprehensionExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        pickOption(0, "In den Garten");
        typeAnswer(1, "Rex");
        submit();
        fireEvent.click(screen.getByTestId("reading-comprehension-retry"));
        expect(screen.getByTestId("reading-comprehension-submit")).toBeDisabled();
        expect(screen.getByTestId("reading-comprehension-q1-input")).toHaveValue("");
        expect(
            screen.getByTestId("reading-comprehension-question-0"),
        ).not.toHaveAttribute("data-verdict");
    });
});

describe("ReadingComprehensionExercise: reviewed (locked) reconstruction", () => {
    it("restores a mixed attempt with the same verdicts + solution as a fresh submit", () => {
        render(
            <ReadingComprehensionExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                reviewed={{
                    kind: "al_reading_comprehension",
                    answers: ["Auf die Straße", "Rex"],
                }}
            />,
        );
        expect(screen.getByTestId("reading-comprehension-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
        expect(screen.getByTestId("reading-comprehension-question-0")).toHaveAttribute(
            "data-verdict",
            "wrong",
        );
        expect(screen.getByTestId("reading-comprehension-q0-solution")).toBeInTheDocument();
        expect(screen.getByTestId("reading-comprehension-q1-input")).toHaveValue("Rex");
        expect(
            screen.queryByTestId("reading-comprehension-submit"),
        ).not.toBeInTheDocument();
    });
});

describe("ReadingComprehensionExercise: answer-position shuffle (#2317)", () => {
    const SHUFFLE_EXERCISE = {
        id: "ex-rc-shuffle",
        type: "ext:al-reading-comprehension",
        prompt: "P",
        card_ids: [],
        distractors: [],
        ext_payload: {
            passage: "text",
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
                },
            ],
        },
    } as unknown as ContentLessonExercise;

    function correctOptionPosition(id: string): number {
        const {unmount} = render(
            <ReadingComprehensionExercise
                exercise={{...SHUFFLE_EXERCISE, id}}
                onComplete={vi.fn()}
            />,
        );
        const block = screen.getByTestId("reading-comprehension-question-0");
        const buttons = Array.from(
            block.querySelectorAll("button[aria-pressed]"),
        );
        const pos = buttons.findIndex((b) => b.textContent?.trim() === "A");
        unmount();
        return pos;
    }

    it("does not place the correct option at a fixed display position across exercises", () => {
        const positions = new Set<number>();
        for (let i = 0; i < 40; i++) {
            positions.add(correctOptionPosition(`ex-rc-${i}`));
        }
        expect(positions.size).toBeGreaterThan(1);
    });

    it("grades by option text regardless of display order", () => {
        const onComplete = vi.fn();
        render(
            <ReadingComprehensionExercise
                exercise={{...SHUFFLE_EXERCISE, id: "ex-rc-grade"}}
                onComplete={onComplete}
            />,
        );
        fireEvent.click(
            within(
                screen.getByTestId("reading-comprehension-question-0"),
            ).getByRole("button", {name: "A"}),
        );
        fireEvent.click(screen.getByTestId("reading-comprehension-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1}),
        );
    });
});
