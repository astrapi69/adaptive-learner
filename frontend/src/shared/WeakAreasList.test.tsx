/**
 * WeakAreasList render tests (#582).
 *
 * Pins: empty state, one row per item, the last-answer line hides when
 * empty, and the practice button fires its callback (and hides when no
 * callback is given).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import WeakAreasList from "./WeakAreasList";

const labels = {
    practiceLabel: "Practice",
    errorsLabel: "errors",
    lastAnswerLabel: "Your last answer:",
    emptyLabel: "Nothing yet.",
};

describe("WeakAreasList", () => {
    it("shows the empty label with no items", () => {
        render(<WeakAreasList items={[]} {...labels} testId="wa" />);
        expect(screen.getByTestId("wa").textContent).toBe("Nothing yet.");
    });

    it("renders rows and fires the practice callback", () => {
        const onPractice = vi.fn();
        render(
            <WeakAreasList
                items={[
                    {id: "1", element: "el libro", errors: 4, last: "la libro", onPractice},
                    {id: "2", element: "la casa", errors: 1, last: ""},
                ]}
                {...labels}
            />,
        );
        expect(screen.getByTestId("weak-area-1")).toHaveTextContent("el libro");
        expect(screen.getByTestId("weak-area-1")).toHaveTextContent("4 errors");
        expect(screen.getByTestId("weak-area-1")).toHaveTextContent("la libro");
        // row 2 has empty last answer → no answer line, no practice button
        expect(screen.getByTestId("weak-area-2")).not.toHaveTextContent(
            "Your last answer:",
        );
        expect(
            screen.queryByTestId("weak-area-practice-2"),
        ).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId("weak-area-practice-1"));
        expect(onPractice).toHaveBeenCalledOnce();
    });
});
