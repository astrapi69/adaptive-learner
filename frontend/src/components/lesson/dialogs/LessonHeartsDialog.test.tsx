/**
 * Tests for the out-of-hearts dialog (#2878): forced choice with a
 * retry and an exit path, hidden while hearts remain.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import LessonHeartsDialog from "./LessonHeartsDialog";

describe("LessonHeartsDialog", () => {
    it("renders nothing while closed", () => {
        render(
            <LessonHeartsDialog open={false} onRetry={vi.fn()} onExit={vi.fn()} />,
        );
        expect(
            screen.queryByTestId("lesson-hearts-dialog"),
        ).not.toBeInTheDocument();
    });

    it("offers retry and exit when open", () => {
        const onRetry = vi.fn();
        const onExit = vi.fn();
        render(
            <LessonHeartsDialog open={true} onRetry={onRetry} onExit={onExit} />,
        );
        expect(screen.getByTestId("lesson-hearts-dialog")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("lesson-hearts-retry"));
        expect(onRetry).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId("lesson-hearts-exit"));
        expect(onExit).toHaveBeenCalledTimes(1);
    });
});
