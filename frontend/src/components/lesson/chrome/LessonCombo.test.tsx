/**
 * Tests for the LessonCombo chip (#2874): hidden below the
 * visibility threshold, visible with the run length and an
 * accessible name from two in a row.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import LessonCombo from "./LessonCombo";

describe("LessonCombo", () => {
    it("renders nothing below two in a row", () => {
        render(<LessonCombo combo={{current: 1, best: 1, bonusEligible: 0}} />);
        expect(screen.queryByTestId("lesson-combo")).not.toBeInTheDocument();
    });

    it("shows the run with an accessible name from two in a row", () => {
        render(<LessonCombo combo={{current: 3, best: 3, bonusEligible: 0}} />);
        const chip = screen.getByTestId("lesson-combo");
        expect(chip).toBeInTheDocument();
        expect(chip).toHaveTextContent("x3");
        expect(chip).toHaveAccessibleName("Answer streak: 3 in a row");
    });

    it("shows the best run on the summary, even after a broken streak", () => {
        render(<LessonCombo combo={{current: 0, best: 5, bonusEligible: 0}} showBest />);
        expect(screen.queryByTestId("lesson-combo")).not.toBeInTheDocument();
        expect(screen.getByTestId("lesson-combo-best")).toHaveTextContent(
            "Best streak: 5",
        );
    });

    it("shows no best chip for a lesson without a real streak", () => {
        render(<LessonCombo combo={{current: 1, best: 1, bonusEligible: 0}} showBest />);
        expect(
            screen.queryByTestId("lesson-combo-best"),
        ).not.toBeInTheDocument();
    });
});

describe("combo bonus XP (#2893)", () => {
    it("shows the credited bonus beside the best chip on the summary", () => {
        render(
            <LessonCombo
                combo={{current: 0, best: 5, bonusEligible: 3}}
                showBest
                bonusXp={3}
            />,
        );
        const bonus = screen.getByTestId("lesson-combo-bonus");
        expect(bonus).toHaveTextContent("+3 XP");
        expect(bonus).toHaveAttribute("title", "Streak bonus: 3 XP");
    });

    it("renders no bonus text when nothing was credited", () => {
        render(
            <LessonCombo
                combo={{current: 0, best: 5, bonusEligible: 0}}
                showBest
            />,
        );
        expect(screen.getByTestId("lesson-combo-best")).toBeInTheDocument();
        expect(
            screen.queryByTestId("lesson-combo-bonus"),
        ).not.toBeInTheDocument();
    });

    it("the live chip never shows the bonus", () => {
        render(
            <LessonCombo
                combo={{current: 3, best: 3, bonusEligible: 1}}
                bonusXp={1}
            />,
        );
        expect(screen.getByTestId("lesson-combo")).toBeInTheDocument();
        expect(
            screen.queryByTestId("lesson-combo-bonus"),
        ).not.toBeInTheDocument();
    });
});
