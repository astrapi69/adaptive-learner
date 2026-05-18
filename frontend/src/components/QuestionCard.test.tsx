import {render, screen, fireEvent} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import QuestionCard from "./QuestionCard";
import type {AssessmentQuestion} from "../types";

const QUESTION: AssessmentQuestion = {
    id: "q01",
    text: "Wie gehst du an ein neues Thema heran?",
    answers: [
        {id: "a", text: "Regeln zuerst.", weights: {deductive: 1.0}},
        {id: "b", text: "Beispiele zuerst.", weights: {inductive: 1.0}},
        {id: "c", text: "Versuch und Irrtum.", weights: {error_based: 1.0}},
    ],
};

describe("QuestionCard", () => {
    it("renders the question text and answer options", () => {
        render(
            <QuestionCard
                question={QUESTION}
                selectedAnswerId={null}
                onSelect={() => {}}
            />,
        );
        expect(screen.getByText(QUESTION.text)).toBeInTheDocument();
        for (const answer of QUESTION.answers) {
            expect(screen.getByText(answer.text)).toBeInTheDocument();
        }
    });

    it("fires onSelect with the answer id when clicked", () => {
        const onSelect = vi.fn();
        render(
            <QuestionCard
                question={QUESTION}
                selectedAnswerId={null}
                onSelect={onSelect}
            />,
        );
        fireEvent.click(screen.getByTestId("question-q01-answer-b"));
        expect(onSelect).toHaveBeenCalledWith("b");
    });

    it("marks the selected option with aria-checked + is-selected", () => {
        render(
            <QuestionCard
                question={QUESTION}
                selectedAnswerId="c"
                onSelect={() => {}}
            />,
        );
        const c = screen.getByTestId("question-q01-answer-c");
        const a = screen.getByTestId("question-q01-answer-a");
        expect(c.getAttribute("aria-checked")).toBe("true");
        expect(a.getAttribute("aria-checked")).toBe("false");
        expect(c.className).toContain("is-selected");
        expect(a.className).not.toContain("is-selected");
    });

    it("disables every answer when ``disabled`` is true", () => {
        render(
            <QuestionCard
                question={QUESTION}
                selectedAnswerId={null}
                onSelect={() => {}}
                disabled
            />,
        );
        const a = screen.getByTestId("question-q01-answer-a") as HTMLButtonElement;
        expect(a.disabled).toBe(true);
    });
});
