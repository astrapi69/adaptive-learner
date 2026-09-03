/**
 * Tests for LessonHearts + LessonCountdownRing (#2878): filled vs
 * hollow hearts, the ring's stages and expiry state - pure
 * presentation pins.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import LessonHearts from "./LessonHearts";
import LessonCountdownRing from "./LessonCountdownRing";

describe("LessonHearts", () => {
    it("renders max hearts with the remaining ones filled", () => {
        render(<LessonHearts hearts={1} maxHearts={3} />);
        expect(screen.getByTestId("lesson-hearts")).toHaveAttribute(
            "data-hearts",
            "1",
        );
        expect(screen.getByTestId("lesson-heart-0")).toHaveAttribute(
            "data-filled",
            "true",
        );
        expect(screen.getByTestId("lesson-heart-1")).toHaveAttribute(
            "data-filled",
            "false",
        );
        expect(screen.getByTestId("lesson-heart-2")).toHaveAttribute(
            "data-filled",
            "false",
        );
    });

    it("shakes only after a heart was lost", () => {
        const {rerender} = render(<LessonHearts hearts={3} maxHearts={3} />);
        expect(screen.getByTestId("lesson-hearts").className).not.toContain(
            "matching-shake",
        );
        rerender(<LessonHearts hearts={2} maxHearts={3} />);
        expect(screen.getByTestId("lesson-hearts").className).toContain(
            "matching-shake",
        );
    });
});

describe("LessonCountdownRing", () => {
    it.each([
        ["green above half", 20, 30, "var(--exercise-correct)"],
        ["yellow above a quarter", 10, 30, "var(--warning)"],
        ["red at the end", 5, 30, "var(--exercise-wrong)"],
    ])("stages the colour: %s", (_label, remaining, total, color) => {
        render(
            <LessonCountdownRing
                remaining={remaining}
                total={total}
                expired={false}
            />,
        );
        expect(
            screen.getByTestId("lesson-countdown-ring-fill"),
        ).toHaveAttribute("stroke", color);
    });

    it("shows the seconds and marks expiry", () => {
        render(<LessonCountdownRing remaining={0} total={30} expired={true} />);
        expect(
            screen.getByTestId("lesson-countdown-ring-seconds"),
        ).toHaveTextContent("0");
        expect(screen.getByTestId("lesson-countdown-ring")).toHaveAttribute(
            "data-expired",
            "true",
        );
    });
});
