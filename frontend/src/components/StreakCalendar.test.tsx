/**
 * StreakCalendar render tests (Phase 29C).
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import StreakCalendar from "./StreakCalendar";

describe("StreakCalendar", () => {
    it("renders the loading placeholder on null entries", () => {
        render(<StreakCalendar entries={null} />);
        expect(screen.getByTestId("streak-calendar-loading")).toBeTruthy();
    });

    it("renders the empty placeholder on []", () => {
        render(<StreakCalendar entries={[]} />);
        expect(screen.getByTestId("streak-calendar-empty")).toBeTruthy();
    });

    it("renders one cell per entry with the correct tier", () => {
        const entries = [
            {date: "2026-05-18", count: 0},
            {date: "2026-05-19", count: 1},
            {date: "2026-05-20", count: 3},
            {date: "2026-05-21", count: 7},
        ];
        render(<StreakCalendar entries={entries} />);
        const t0 = screen.getByTestId("streak-cell-2026-05-18");
        const t1 = screen.getByTestId("streak-cell-2026-05-19");
        const t2 = screen.getByTestId("streak-cell-2026-05-20");
        const t4 = screen.getByTestId("streak-cell-2026-05-21");
        expect(t0.getAttribute("data-tier")).toBe("0");
        expect(t1.getAttribute("data-tier")).toBe("1");
        expect(t2.getAttribute("data-tier")).toBe("2");
        expect(t4.getAttribute("data-tier")).toBe("4");
    });
});
