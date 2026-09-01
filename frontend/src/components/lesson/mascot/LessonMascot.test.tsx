/**
 * Tests for LessonMascot (#2849): renders only in playful mode,
 * reacts to celebration-bus events with poses, shows the
 * lesson-complete bubble, and carries an accessible name.
 */

import "@testing-library/jest-dom/vitest";
import {act, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it} from "vitest";

import LessonMascot from "./LessonMascot";
import {emitCelebration} from "../../../lib/praise/celebration-bus";
import {setPlayfulMode} from "../../../lib/learning/playfulModePref";

beforeEach(() => {
    localStorage.clear();
});

describe("LessonMascot", () => {
    it("renders nothing while playful mode is off", () => {
        render(<LessonMascot />);
        expect(screen.queryByTestId("lesson-mascot")).not.toBeInTheDocument();
    });

    it("renders the idle figure with an accessible name in playful mode", () => {
        setPlayfulMode(true);
        render(<LessonMascot />);
        const mascot = screen.getByTestId("lesson-mascot");
        expect(mascot).toBeInTheDocument();
        expect(mascot).toHaveAttribute("data-pose", "idle");
        expect(screen.getByRole("img")).toHaveAccessibleName();
    });

    it("switches the pose on a correct answer", () => {
        setPlayfulMode(true);
        render(<LessonMascot />);
        act(() => emitCelebration({type: "answer_correct"}));
        expect(screen.getByTestId("lesson-mascot")).toHaveAttribute(
            "data-pose",
            "cheer",
        );
    });

    it("shows the speech bubble on lesson_complete", () => {
        setPlayfulMode(true);
        render(<LessonMascot />);
        act(() =>
            emitCelebration({type: "lesson_complete", payload: {stars: 2}}),
        );
        expect(screen.getByTestId("lesson-mascot-bubble")).toBeInTheDocument();
        expect(
            screen.getByTestId("lesson-mascot-bubble").textContent,
        ).not.toBe("");
    });

    it("appears live when playful mode turns on (change event)", () => {
        render(<LessonMascot />);
        expect(screen.queryByTestId("lesson-mascot")).not.toBeInTheDocument();
        act(() => setPlayfulMode(true));
        expect(screen.getByTestId("lesson-mascot")).toBeInTheDocument();
    });
});
