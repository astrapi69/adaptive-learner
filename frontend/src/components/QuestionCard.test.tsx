import {render, screen, fireEvent} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import QuestionCard from "./QuestionCard";
import type {AssessmentQuestion} from "../types";

const SINGLE: AssessmentQuestion = {
    id: "q03",
    type: "single",
    text: "Welches Lerntempo fühlt sich richtig an?",
    answers: [
        {id: "a", text: "Strukturiert.", weights: {deductive: 1.0}},
        {id: "b", text: "Exploratorisch.", weights: {error_based: 0.5}},
        {id: "c", text: "Anpassbar.", weights: {ai_adaptive: 1.0}},
    ],
};

const MULTI: AssessmentQuestion = {
    id: "q01",
    type: "multi",
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
                question={SINGLE}
                selectedAnswerIds={[]}
                onToggle={() => {}}
            />,
        );
        expect(screen.getByText(SINGLE.text)).toBeInTheDocument();
        for (const answer of SINGLE.answers) {
            expect(screen.getByText(answer.text)).toBeInTheDocument();
        }
    });

    it("fires onToggle with the answer id when clicked", () => {
        const onToggle = vi.fn();
        render(
            <QuestionCard
                question={SINGLE}
                selectedAnswerIds={[]}
                onToggle={onToggle}
            />,
        );
        fireEvent.click(screen.getByTestId("question-q03-answer-b"));
        expect(onToggle).toHaveBeenCalledWith("b");
    });

    it("marks the selected option with aria-checked + is-selected", () => {
        render(
            <QuestionCard
                question={SINGLE}
                selectedAnswerIds={["c"]}
                onToggle={() => {}}
            />,
        );
        const c = screen.getByTestId("question-q03-answer-c");
        const a = screen.getByTestId("question-q03-answer-a");
        expect(c.getAttribute("aria-checked")).toBe("true");
        expect(a.getAttribute("aria-checked")).toBe("false");
        expect(c.className).toContain("is-selected");
        expect(a.className).not.toContain("is-selected");
    });

    it("disables every answer when ``disabled`` is true", () => {
        render(
            <QuestionCard
                question={SINGLE}
                selectedAnswerIds={[]}
                onToggle={() => {}}
                disabled
            />,
        );
        const a = screen.getByTestId("question-q03-answer-a") as HTMLButtonElement;
        expect(a.disabled).toBe(true);
    });

    // --- v0.4.0: multi-select -------------------------------------------

    it("single-select questions use role=radio for each answer", () => {
        render(
            <QuestionCard
                question={SINGLE}
                selectedAnswerIds={[]}
                onToggle={() => {}}
            />,
        );
        const a = screen.getByTestId("question-q03-answer-a");
        expect(a.getAttribute("role")).toBe("radio");
        // ``radiogroup`` role on the wrapping div.
        expect(
            screen.getByRole("radiogroup", {name: SINGLE.text}),
        ).toBeInTheDocument();
    });

    it("multi-select questions use role=checkbox for each answer", () => {
        render(
            <QuestionCard
                question={MULTI}
                selectedAnswerIds={[]}
                onToggle={() => {}}
            />,
        );
        const a = screen.getByTestId("question-q01-answer-a");
        expect(a.getAttribute("role")).toBe("checkbox");
        // ``group`` role on the wrapping div (NOT radiogroup).
        expect(
            screen.queryByRole("radiogroup", {name: MULTI.text}),
        ).not.toBeInTheDocument();
    });

    it("multi-select renders multiple selected options simultaneously", () => {
        render(
            <QuestionCard
                question={MULTI}
                selectedAnswerIds={["a", "c"]}
                onToggle={() => {}}
            />,
        );
        expect(
            screen.getByTestId("question-q01-answer-a").getAttribute("aria-checked"),
        ).toBe("true");
        expect(
            screen.getByTestId("question-q01-answer-c").getAttribute("aria-checked"),
        ).toBe("true");
        expect(
            screen.getByTestId("question-q01-answer-b").getAttribute("aria-checked"),
        ).toBe("false");
    });

    it("multi-select shows checkbox glyph; single-select shows radio glyph", () => {
        const {rerender} = render(
            <QuestionCard
                question={SINGLE}
                selectedAnswerIds={["a"]}
                onToggle={() => {}}
            />,
        );
        expect(
            screen.getByTestId("question-q03-answer-a").textContent,
        ).toContain("●");
        rerender(
            <QuestionCard
                question={MULTI}
                selectedAnswerIds={["a"]}
                onToggle={() => {}}
            />,
        );
        expect(
            screen.getByTestId("question-q01-answer-a").textContent,
        ).toContain("☑");
    });
});
