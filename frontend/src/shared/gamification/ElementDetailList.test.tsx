/**
 * ElementDetailList tests (#588).
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import ElementDetailList from "./ElementDetailList";

describe("ElementDetailList", () => {
    it("renders the empty label with no items", () => {
        render(
            <ElementDetailList
                items={[]}
                lastAnswerLabel="Your answer:"
                correctLabel="Correct:"
                emptyLabel="Nothing tracked."
                testId="ed"
            />,
        );
        expect(screen.getByTestId("ed").textContent).toBe("Nothing tracked.");
    });

    it("renders a row with status, meta, and answers", () => {
        render(
            <ElementDetailList
                items={[
                    {
                        id: "el-1",
                        element: "el libro",
                        tone: "warning",
                        statusLabel: "Due now",
                        metaLabel: "Streak 0 · 3 errors",
                        lastAnswer: "la libro",
                        correctAnswer: "el libro",
                    },
                ]}
                lastAnswerLabel="Your answer:"
                correctLabel="Correct:"
                emptyLabel="empty"
            />,
        );
        const row = screen.getByTestId("element-detail-el-1");
        expect(row).toHaveTextContent("el libro");
        expect(row).toHaveTextContent("Due now");
        expect(row).toHaveTextContent("Streak 0 · 3 errors");
        expect(row).toHaveTextContent("la libro");
    });
});
