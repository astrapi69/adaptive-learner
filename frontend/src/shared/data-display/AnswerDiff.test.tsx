/**
 * AnswerDiff tests (#599).
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import AnswerDiff from "./AnswerDiff";

describe("AnswerDiff", () => {
    it("shows both rows with their labels", () => {
        render(
            <AnswerDiff
                userAnswer="la libro"
                correctAnswer="el libro"
                yourLabel="Your answer:"
                correctLabel="Correct:"
                testId="ad"
            />,
        );
        expect(screen.getByTestId("ad-your")).toHaveTextContent("Your answer:");
        expect(screen.getByTestId("ad-your")).toHaveTextContent("la");
        expect(screen.getByTestId("ad-correct")).toHaveTextContent("Correct:");
        expect(screen.getByTestId("ad-correct")).toHaveTextContent("el");
    });

    it("renders the empty-answer placeholder when the user answer is blank", () => {
        render(
            <AnswerDiff
                userAnswer=""
                correctAnswer="el libro"
                yourLabel="Your answer:"
                correctLabel="Correct:"
                emptyAnswerLabel="(no answer)"
                testId="ad2"
            />,
        );
        expect(screen.getByTestId("ad2-your")).toHaveTextContent("(no answer)");
    });
});
