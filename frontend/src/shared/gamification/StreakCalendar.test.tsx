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

    const WEEK: StreakDay[] = Array.from({length: 7}, (_, i) => ({
        date: `2026-06-0${i + 1}`,
        count: i,
    }));

    it.each([
        {name: "weeks (default)", layout: undefined, columns: 1, cellsPerColumn: 7},
        {name: "row", layout: "row" as const, columns: 7, cellsPerColumn: 1},
    ])(
        "lays seven days out as $name: $columns column(s) of $cellsPerColumn cell(s) (#3417)",
        ({layout, columns, cellsPerColumn}) => {
            cleanup();
            render(<StreakCalendar days={WEEK} layout={layout} />);
            const root = screen.getByTestId("streak-calendar");
            expect(root.children).toHaveLength(columns);
            for (const column of Array.from(root.children)) {
                const cells = column.hasAttribute("data-tier")
                    ? [column]
                    : Array.from(column.children);
                expect(cells).toHaveLength(cellsPerColumn);
            }
        },
    );

    it("keeps the day order left to right in the row layout (#3417)", () => {
        cleanup();
        render(<StreakCalendar days={WEEK} layout="row" />);
        const dates = Array.from(
            screen.getByTestId("streak-calendar").children,
        ).map((cell) => cell.getAttribute("data-testid"));
        expect(dates).toEqual(
            WEEK.map((d) => `streak-calendar-cell-${d.date}`),
        );
    });

    it.each([["weeks", undefined], ["row", "row" as const]])(
        "pads the %s strip so the today outline is not clipped (#3417)",
        (_name, layout) => {
            cleanup();
            render(
                <StreakCalendar days={WEEK} today="2026-06-07" layout={layout} />,
            );
            expect(
                screen.getByTestId("streak-calendar").classList.contains("p-[3px]"),
            ).toBe(true);
        },
    );
});
