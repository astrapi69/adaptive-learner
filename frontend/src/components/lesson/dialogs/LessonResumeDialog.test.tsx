/**
 * Tests for the lesson resume dialog (Phase 63C / EXP-020).
 *
 * Pins:
 * - Hidden when open=false
 * - Renders title + body text when open=true
 * - "Continue" calls onResume (not onStartOver)
 * - "Start over" asks for confirmation, then calls onStartOver (#3361)
 * - Action buttons are spaced apart (regression #2637)
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

    it("Start over asks for confirmation first and calls onStartOver only on confirm (#3361)", () => {
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
        expect(onStartOver).not.toHaveBeenCalled();
        expect(screen.getByTestId("lesson-resume-confirm-restart")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("lesson-resume-confirm-restart-action"));
        expect(onStartOver).toHaveBeenCalledTimes(1);
        expect(onResume).not.toHaveBeenCalled();
    });

    it("backing out of the confirmation returns to the choice without restarting (#3361)", () => {
        const onStartOver = vi.fn();
        render(
            <LessonResumeDialog
                open={true}
                lessonTitle="Greetings"
                onResume={vi.fn()}
                onStartOver={onStartOver}
            />,
        );
        fireEvent.click(screen.getByTestId("lesson-resume-restart"));
        fireEvent.click(screen.getByTestId("lesson-resume-confirm-back"));
        expect(onStartOver).not.toHaveBeenCalled();
        expect(screen.getByTestId("lesson-resume-continue")).toBeInTheDocument();
    });

    it("spaces the action buttons apart (regression #2637)", () => {
        render(
            <LessonResumeDialog
                open={true}
                lessonTitle="Greetings"
                onResume={vi.fn()}
                onStartOver={vi.fn()}
            />,
        );
        // #2637: the actions row shipped with a styling-hook class that no
        // CSS rule defined, so the two buttons rendered flush against each
        // other. Pin the token-backed utilities that provide the gap.
        const actions = screen.getByTestId("lesson-resume-continue")
            .parentElement as HTMLElement;
        expect(actions.className).toMatch(/\bflex\b/);
        expect(actions.className).toMatch(/\bgap-3\b/);
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
