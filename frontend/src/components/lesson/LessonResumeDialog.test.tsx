/**
 * Tests for the lesson resume dialog (Phase 63C / EXP-020).
 *
 * Pins:
 * - Hidden when open=false
 * - Renders title + body text when open=true
 * - "Continue" calls onResume (not onStartOver)
 * - "Start over" calls onStartOver (not onResume)
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import LessonResumeDialog from "./LessonResumeDialog";

describe("LessonResumeDialog", () => {
    it("renders nothing when open=false", () => {
        render(
            <LessonResumeDialog
                open={false}
                lessonTitle="Greetings"
                onResume={vi.fn()}
                onStartOver={vi.fn()}
            />,
        );
        expect(
            screen.queryByTestId("lesson-resume-dialog"),
        ).not.toBeInTheDocument();
    });

    it("renders the heading and lesson title when open=true", () => {
        render(
            <LessonResumeDialog
                open={true}
                lessonTitle="Greetings"
                onResume={vi.fn()}
                onStartOver={vi.fn()}
            />,
        );
        expect(
            screen.getByTestId("lesson-resume-dialog"),
        ).toBeInTheDocument();
        // Lesson title appears in the body text
        expect(screen.getByText(/Greetings/)).toBeInTheDocument();
    });

    it("calls onResume and not onStartOver when Continue is clicked", () => {
        const onResume = vi.fn();
        const onStartOver = vi.fn();
        render(
            <LessonResumeDialog
                open={true}
                lessonTitle="Greetings"
                onResume={onResume}
                onStartOver={onStartOver}
            />,
        );
        fireEvent.click(screen.getByTestId("lesson-resume-continue"));
        expect(onResume).toHaveBeenCalledTimes(1);
        expect(onStartOver).not.toHaveBeenCalled();
    });

    it("calls onStartOver and not onResume when Start over is clicked", () => {
        const onResume = vi.fn();
        const onStartOver = vi.fn();
        render(
            <LessonResumeDialog
                open={true}
                lessonTitle="Greetings"
                onResume={onResume}
                onStartOver={onStartOver}
            />,
        );
        fireEvent.click(screen.getByTestId("lesson-resume-restart"));
        expect(onStartOver).toHaveBeenCalledTimes(1);
        expect(onResume).not.toHaveBeenCalled();
    });

    it("has role=dialog and aria-modal=true for accessibility", () => {
        render(
            <LessonResumeDialog
                open={true}
                lessonTitle="Greetings"
                onResume={vi.fn()}
                onStartOver={vi.fn()}
            />,
        );
        const dialog = screen.getByTestId("lesson-resume-dialog");
        expect(dialog).toHaveAttribute("role", "dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
    });
});
