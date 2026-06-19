/**
 * ReviewSummary tests (#599).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import ReviewSummary from "./ReviewSummary";

describe("ReviewSummary", () => {
    it("renders corrected/total + percent, optional lines, and exit", () => {
        const onExit = vi.fn();
        render(
            <ReviewSummary
                heading="Review complete"
                corrected={5}
                total={8}
                correctedLabel="5 of 8 corrected"
                trendLabel="Getting stronger"
                nextReviewLabel="Soon"
                exitLabel="Back"
                onExit={onExit}
                testId="rs"
            />,
        );
        expect(screen.getByTestId("rs-corrected")).toHaveTextContent(
            "5 of 8 corrected (63%)",
        );
        expect(screen.getByTestId("rs-trend")).toHaveTextContent(
            "Getting stronger",
        );
        expect(screen.getByTestId("rs-next")).toHaveTextContent("Soon");
        fireEvent.click(screen.getByTestId("rs-exit"));
        expect(onExit).toHaveBeenCalledOnce();
    });

    it("omits the optional lines when not provided", () => {
        render(
            <ReviewSummary
                heading="Done"
                corrected={0}
                total={0}
                correctedLabel="0 of 0 corrected"
                exitLabel="Back"
                onExit={() => {}}
                testId="rs2"
            />,
        );
        expect(screen.queryByTestId("rs2-trend")).not.toBeInTheDocument();
        expect(screen.getByTestId("rs2-corrected")).toHaveTextContent("(0%)");
    });
});
