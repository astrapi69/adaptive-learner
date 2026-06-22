/**
 * Tests for RetryResultComparison (#983) — the post-retry improvement
 * panel on the lesson summary.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import RetryResultComparison from "./RetryResultComparison";
import type {LessonAttempt} from "../../../storage/types";

function attempt(correct: number, total: number, at = "2026-06-22T00:00:00Z"): LessonAttempt {
    return {at, correct, total};
}

describe("RetryResultComparison", () => {
    it("renders nothing on a first attempt", () => {
        const {container} = render(
            <RetryResultComparison
                attempts={1}
                attemptHistory={[attempt(3, 5)]}
                bestCorrect={3}
                bestTotal={5}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the improvement + errors fixed + new record after a better retry", () => {
        // 60% -> 100%: +40%, 2 errors fixed of 2, new record.
        render(
            <RetryResultComparison
                attempts={2}
                attemptHistory={[attempt(3, 5), attempt(5, 5)]}
                bestCorrect={5}
                bestTotal={5}
            />,
        );
        expect(screen.getByTestId("retry-comparison")).toBeInTheDocument();
        expect(screen.getByTestId("retry-attempt-line")).toHaveTextContent("100%");
        expect(screen.getByTestId("retry-attempt-line")).toHaveTextContent("60%");
        expect(screen.getByTestId("retry-improvement-line")).toHaveTextContent("+40%");
        expect(screen.getByTestId("retry-errors-fixed-line")).toHaveTextContent("2 of 2");
        expect(screen.getByTestId("retry-best-line")).toHaveTextContent("100%");
        expect(screen.getByTestId("retry-new-record")).toBeInTheDocument();
    });

    it("keeps the best + no new record after a worse retry", () => {
        // 100% -> 40%: -60%, best stays 100%, no new record.
        render(
            <RetryResultComparison
                attempts={2}
                attemptHistory={[attempt(5, 5), attempt(2, 5)]}
                bestCorrect={5}
                bestTotal={5}
            />,
        );
        expect(screen.getByTestId("retry-improvement-line")).toHaveTextContent("−60%");
        expect(screen.getByTestId("retry-best-line")).toHaveTextContent("100%");
        // The best was the FIRST attempt.
        expect(screen.getByTestId("retry-best-line")).toHaveTextContent("attempt 1");
        expect(screen.queryByTestId("retry-new-record")).not.toBeInTheDocument();
    });
});
