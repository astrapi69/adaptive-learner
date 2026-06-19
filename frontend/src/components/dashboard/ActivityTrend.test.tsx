import {describe, it, expect, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";

import ActivityTrend from "./ActivityTrend";
import type {HeatmapEntryOut} from "../../storage/types";

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fb?: string) => fb ?? _k}),
}));

function series(counts: number[]): HeatmapEntryOut[] {
    return counts.map((count, i) => ({
        date: `2026-06-${String(i + 1).padStart(2, "0")}`,
        count,
    }));
}

describe("ActivityTrend", () => {
    it("renders nothing without data", () => {
        cleanup();
        const {container} = render(<ActivityTrend entries={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("flags an upward trend (last 7 > prev 7)", () => {
        cleanup();
        // prev7 sum=7, last7 sum=14
        render(<ActivityTrend entries={series([1,1,1,1,1,1,1, 2,2,2,2,2,2,2])} />);
        expect(
            screen.getByTestId("activity-trend-indicator"),
        ).toHaveAttribute("data-direction", "up");
        expect(screen.getByTestId("activity-sparkline")).toBeInTheDocument();
    });

    it("flags a downward trend", () => {
        cleanup();
        render(<ActivityTrend entries={series([3,3,3,3,3,3,3, 0,0,0,1,0,0,0])} />);
        expect(
            screen.getByTestId("activity-trend-indicator"),
        ).toHaveAttribute("data-direction", "down");
    });

    it("flags a flat trend", () => {
        cleanup();
        render(<ActivityTrend entries={series([1,1,1,1,1,1,1, 1,1,1,1,1,1,1])} />);
        expect(
            screen.getByTestId("activity-trend-indicator"),
        ).toHaveAttribute("data-direction", "flat");
    });

    it("renders only the last 7 days in the sparkline", () => {
        cleanup();
        render(<ActivityTrend entries={series([1,1,1,1,1,1,1, 2,2,2,2,2,2,2])} />);
        // Day 14 (last) present, day 1 (outside last 7) absent.
        expect(
            screen.getByTestId("activity-sparkline-cell-2026-06-14"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("activity-sparkline-cell-2026-06-01"),
        ).not.toBeInTheDocument();
    });
});
