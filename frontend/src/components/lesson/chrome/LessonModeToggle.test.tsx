/**
 * Tests for LessonModeToggle (#1007): renders both modes, reflects the
 * active one, fires onChange, and disables when the lesson is under way.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import LessonModeToggle from "./LessonModeToggle";

describe("LessonModeToggle", () => {
    it("reflects the active mode via aria-pressed", () => {
        render(<LessonModeToggle mode="practice" onChange={() => {}} />);
        expect(screen.getByTestId("lesson-mode-practice")).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        expect(screen.getByTestId("lesson-mode-exam")).toHaveAttribute(
            "aria-pressed",
            "false",
        );
    });

    it("fires onChange with the picked mode", () => {
        const onChange = vi.fn();
        render(<LessonModeToggle mode="practice" onChange={onChange} />);
        fireEvent.click(screen.getByTestId("lesson-mode-exam"));
        expect(onChange).toHaveBeenCalledWith("exam");
    });

    it("offers the timed mode (#1009)", () => {
        const onChange = vi.fn();
        render(<LessonModeToggle mode="timed" onChange={onChange} />);
        expect(screen.getByTestId("lesson-mode-timed")).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        fireEvent.click(screen.getByTestId("lesson-mode-practice"));
        expect(onChange).toHaveBeenCalledWith("practice");
    });

    it("offers the reverse mode (#1013)", () => {
        const onChange = vi.fn();
        render(<LessonModeToggle mode="reverse" onChange={onChange} />);
        expect(screen.getByTestId("lesson-mode-reverse")).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        fireEvent.click(screen.getByTestId("lesson-mode-practice"));
        expect(onChange).toHaveBeenCalledWith("practice");
    });

    it("disables both buttons when the lesson is under way", () => {
        render(
            <LessonModeToggle mode="exam" onChange={() => {}} disabled />,
        );
        expect(screen.getByTestId("lesson-mode-practice")).toBeDisabled();
        expect(screen.getByTestId("lesson-mode-exam")).toBeDisabled();
    });
});
