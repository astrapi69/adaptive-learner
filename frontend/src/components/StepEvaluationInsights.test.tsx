import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import StepEvaluationInsights from "./StepEvaluationInsights";
import type {StepEvaluationSummary} from "../types";

const EMPTY: StepEvaluationSummary = {
    total_evaluations: 0,
    average_confidence: 0,
    advance_count: 0,
    repeat_count: 0,
    backward_count: 0,
    fallback_count: 0,
    evaluations_per_step: {},
    time_seconds_per_step: {},
};

const POPULATED: StepEvaluationSummary = {
    total_evaluations: 10,
    average_confidence: 0.82,
    advance_count: 6,
    repeat_count: 3,
    backward_count: 1,
    fallback_count: 0,
    evaluations_per_step: {"1": 2, "2": 4, "3": 4},
    time_seconds_per_step: {"1": 30, "2": 240, "3": 90},
};

describe("StepEvaluationInsights", () => {
    it("renders the empty state when summary is null", () => {
        render(<StepEvaluationInsights summary={null} />);
        expect(
            screen.getByTestId("step-eval-insights-empty"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("step-eval-insights"),
        ).not.toBeInTheDocument();
    });

    it("renders the empty state when total_evaluations is 0", () => {
        render(<StepEvaluationInsights summary={EMPTY} />);
        expect(
            screen.getByTestId("step-eval-insights-empty"),
        ).toBeInTheDocument();
    });

    it("renders the three core metrics with rounded confidence as %", () => {
        render(<StepEvaluationInsights summary={POPULATED} />);
        expect(screen.getByTestId("step-eval-insights")).toBeInTheDocument();
        // Average confidence 0.82 -> 82%
        expect(
            screen.getByTestId("step-eval-confidence").textContent,
        ).toContain("82%");
        // Repeats = 3
        expect(
            screen.getByTestId("step-eval-repeats").textContent,
        ).toContain("3");
        // Advances = 6
        expect(
            screen.getByTestId("step-eval-advances").textContent,
        ).toContain("6");
    });

    it("renders backward-transition tile only when count > 0", () => {
        render(<StepEvaluationInsights summary={POPULATED} />);
        expect(
            screen.getByTestId("step-eval-backward"),
        ).toBeInTheDocument();
        // No-backward variant.
        render(
            <StepEvaluationInsights
                summary={{...POPULATED, backward_count: 0}}
            />,
        );
        // The "no-backward" instance from the second render is in
        // the same DOM; assert the count is 1 (from the first
        // render) not 2.
        expect(
            screen.getAllByTestId("step-eval-backward"),
        ).toHaveLength(1);
    });

    it("renders the stickiest step (highest seconds) with formatted duration", () => {
        render(<StepEvaluationInsights summary={POPULATED} />);
        const stickiest = screen.getByTestId("step-eval-stickiest");
        // Step 2 has 240s — the most time. Step 2 = "attempt" in the
        // canonical cycle.
        expect(stickiest.textContent).toMatch(
            /attempt|Versuch|Intento|Tentative|Προσπάθεια/i,
        );
        // 240s = 4 min.
        expect(stickiest.textContent).toContain("4 min");
    });

    it("formats seconds < 60 as 'Ns', minutes < 60 as 'N min', >= 1h as 'Nh' or 'Nh Mm'", () => {
        // 45 seconds → "45s"
        const fortyFive: StepEvaluationSummary = {
            ...EMPTY,
            total_evaluations: 1,
            time_seconds_per_step: {"3": 45},
        };
        const {rerender} = render(<StepEvaluationInsights summary={fortyFive} />);
        expect(screen.getByTestId("step-eval-stickiest").textContent).toContain("45s");

        // 3660 seconds = 1h 1m
        const oneHourOneMin: StepEvaluationSummary = {
            ...EMPTY,
            total_evaluations: 1,
            time_seconds_per_step: {"3": 3660},
        };
        rerender(<StepEvaluationInsights summary={oneHourOneMin} />);
        expect(screen.getByTestId("step-eval-stickiest").textContent).toContain("1h 1m");

        // 7200 seconds = 2h (clean)
        const twoHours: StepEvaluationSummary = {
            ...EMPTY,
            total_evaluations: 1,
            time_seconds_per_step: {"3": 7200},
        };
        rerender(<StepEvaluationInsights summary={twoHours} />);
        expect(screen.getByTestId("step-eval-stickiest").textContent).toContain("2h");
    });

    it("hides stickiest tile when time_seconds_per_step is empty (zero gaps)", () => {
        // Edge: total_evaluations > 0 but no time accumulated yet
        // (e.g. a single evaluation row, no consecutive pair to
        // compute a gap from).
        const noGap: StepEvaluationSummary = {
            ...EMPTY,
            total_evaluations: 1,
            advance_count: 1,
            average_confidence: 0.9,
        };
        render(<StepEvaluationInsights summary={noGap} />);
        expect(screen.getByTestId("step-eval-insights")).toBeInTheDocument();
        expect(
            screen.queryByTestId("step-eval-stickiest"),
        ).not.toBeInTheDocument();
    });

    it("ignores out-of-range step keys in time_seconds_per_step", () => {
        const corrupt: StepEvaluationSummary = {
            ...EMPTY,
            total_evaluations: 5,
            average_confidence: 0.5,
            // 8 is out of range, 0 too — must not appear.
            time_seconds_per_step: {"0": 500, "8": 999, "3": 60},
        };
        render(<StepEvaluationInsights summary={corrupt} />);
        const stickiest = screen.getByTestId("step-eval-stickiest");
        // The 999 and 500 rows are filtered; step 3 ("error") wins.
        expect(stickiest.textContent).toMatch(/error|Fehler|Errores|Erreurs|Λάθη/i);
    });
});
