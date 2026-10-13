/**
 * LessonModeControl (#3742): the learner's own pass threshold says that a
 * set with its own pass mark uses that mark, so "80 %" in Settings and
 * "pass from 60 %" on a set's exam card do not read as a contradiction.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import LessonModeControl from "./LessonModeControl";

describe("LessonModeControl threshold hint (#3742)", () => {
    it("says under the threshold that a set's own pass mark wins", () => {
        render(<LessonModeControl />);
        const hint = screen.getByTestId("lesson-mode-threshold-set-hint");
        expect(hint).toHaveTextContent("Sets with their own pass mark use that mark instead.");
        expect(screen.getByTestId("lesson-mode-threshold-select")).toBeInTheDocument();
    });
});
