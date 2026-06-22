/**
 * Tests for LessonCountdownBar (#1009): the fill width/colour by remaining
 * fraction and the urgent (last-5s) flag.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import LessonCountdownBar from "./LessonCountdownBar";

describe("LessonCountdownBar", () => {
    it("renders the progressbar with the remaining value", () => {
        render(<LessonCountdownBar remaining={20} total={30} />);
        const bar = screen.getByRole("progressbar");
        expect(bar).toHaveAttribute("aria-valuenow", "20");
        expect(bar).toHaveAttribute("aria-valuemax", "30");
    });

    it("flags urgency in the final 5 seconds", () => {
        const {rerender} = render(<LessonCountdownBar remaining={20} total={30} />);
        expect(screen.getByTestId("lesson-countdown")).toHaveAttribute(
            "data-urgent",
            "false",
        );
        rerender(<LessonCountdownBar remaining={4} total={30} />);
        expect(screen.getByTestId("lesson-countdown")).toHaveAttribute(
            "data-urgent",
            "true",
        );
    });

    it("clamps remaining into [0, total]", () => {
        render(<LessonCountdownBar remaining={99} total={30} />);
        expect(screen.getByTestId("lesson-countdown")).toHaveAttribute(
            "data-remaining",
            "30",
        );
    });

    it("colours the fill green/yellow/red by fraction", () => {
        const {rerender} = render(<LessonCountdownBar remaining={25} total={30} />);
        const fill = () => screen.getByTestId("lesson-countdown-fill");
        expect(fill().style.backgroundColor).toContain("--exercise-correct");
        rerender(<LessonCountdownBar remaining={10} total={30} />); // ~33%
        expect(fill().style.backgroundColor).toContain("--warning");
        rerender(<LessonCountdownBar remaining={5} total={30} />); // ~16%
        expect(fill().style.backgroundColor).toContain("--exercise-wrong");
    });
});
