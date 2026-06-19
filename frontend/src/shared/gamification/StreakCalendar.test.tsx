import {describe, it, expect} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";

import StreakCalendar, {type StreakDay} from "./StreakCalendar";

const DAYS: StreakDay[] = [
    {date: "2026-06-01", count: 0},
    {date: "2026-06-02", count: 1},
    {date: "2026-06-03", count: 4},
    {date: "2026-06-04", count: 9},
];

describe("StreakCalendar", () => {
    it("renders the empty state when no days", () => {
        cleanup();
        render(<StreakCalendar days={[]} emptyLabel="Nothing yet" />);
        expect(screen.getByTestId("streak-calendar-empty")).toHaveTextContent(
            "Nothing yet",
        );
    });

    it("renders a cell per day with default intensity tiers", () => {
        cleanup();
        render(<StreakCalendar days={DAYS} />);
        expect(
            screen.getByTestId("streak-calendar-cell-2026-06-01"),
        ).toHaveAttribute("data-tier", "0");
        expect(
            screen.getByTestId("streak-calendar-cell-2026-06-02"),
        ).toHaveAttribute("data-tier", "1");
        expect(
            screen.getByTestId("streak-calendar-cell-2026-06-03"),
        ).toHaveAttribute("data-tier", "3");
        expect(
            screen.getByTestId("streak-calendar-cell-2026-06-04"),
        ).toHaveAttribute("data-tier", "4");
    });

    it("marks today", () => {
        cleanup();
        render(<StreakCalendar days={DAYS} today="2026-06-03" />);
        expect(
            screen.getByTestId("streak-calendar-cell-2026-06-03"),
        ).toHaveAttribute("data-today", "true");
        expect(
            screen.getByTestId("streak-calendar-cell-2026-06-02"),
        ).toHaveAttribute("data-today", "false");
    });

    it("localizes the cell title via the cellTitle prop", () => {
        cleanup();
        render(
            <StreakCalendar
                days={DAYS}
                cellTitle={(d, c) => `${c} sessions / ${d}`}
            />,
        );
        expect(
            screen.getByTestId("streak-calendar-cell-2026-06-02"),
        ).toHaveAttribute("title", "1 sessions / 2026-06-02");
    });

    it("honours a custom tierFor", () => {
        cleanup();
        render(<StreakCalendar days={DAYS} tierFor={() => 2} />);
        expect(
            screen.getByTestId("streak-calendar-cell-2026-06-01"),
        ).toHaveAttribute("data-tier", "2");
    });
});
