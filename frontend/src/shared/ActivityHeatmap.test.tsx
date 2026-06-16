/**
 * ActivityHeatmap render tests (#582).
 *
 * Pins the presentational contract: empty state, one cell per dated
 * entry, tier assignment from the count, and caller-driven labels.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import ActivityHeatmap from "./ActivityHeatmap";

describe("ActivityHeatmap", () => {
    it("renders the empty label when there is no data", () => {
        render(
            <ActivityHeatmap
                data={[]}
                ariaLabel="Activity"
                cellLabel={(d, c) => `${c} on ${d}`}
                emptyLabel="No activity yet."
                testId="hm"
            />,
        );
        expect(screen.getByTestId("hm").textContent).toBe("No activity yet.");
    });

    it("renders a cell per dated entry with the right tier", () => {
        render(
            <ActivityHeatmap
                data={[
                    {date: "2026-03-09", count: 0},
                    {date: "2026-03-10", count: 1},
                    {date: "2026-03-11", count: 4},
                    {date: "2026-03-12", count: 9},
                ]}
                ariaLabel="Activity"
                cellLabel={(d, c) => `${c} lessons on ${d}`}
                emptyLabel="empty"
                tierBounds={[1, 3, 5]}
            />,
        );
        expect(screen.getByTestId("activity-cell-2026-03-09")).toHaveAttribute(
            "data-tier",
            "0",
        );
        expect(screen.getByTestId("activity-cell-2026-03-10")).toHaveAttribute(
            "data-tier",
            "1",
        );
        expect(screen.getByTestId("activity-cell-2026-03-11")).toHaveAttribute(
            "data-tier",
            "3",
        );
        const top = screen.getByTestId("activity-cell-2026-03-12");
        expect(top).toHaveAttribute("data-tier", "4");
        expect(top).toHaveAttribute("aria-label", "9 lessons on 2026-03-12");
    });
});
