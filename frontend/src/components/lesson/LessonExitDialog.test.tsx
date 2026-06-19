/**
 * LessonExitDialog (Phase 63B) — three-button exit picker plus
 * an abandon sub-confirm. The dialog itself is presentational;
 * the lifecycle mutations live on the parent. These tests pin
 * the user-visible UX: which buttons appear, in which order, and
 * which callback fires on click.
 */

import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import LessonExitDialog from "./LessonExitDialog";

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        lang: "en",
    }),
}));

describe("LessonExitDialog", () => {
    function setup(open = true) {
        const onPause = vi.fn();
        const onAbandon = vi.fn();
        const onContinue = vi.fn();
        render(
            <LessonExitDialog
                open={open}
                onPause={onPause}
                onAbandon={onAbandon}
                onContinue={onContinue}
            />,
        );
        return {onPause, onAbandon, onContinue};
    }

    it("renders nothing when closed", () => {
        setup(false);
        expect(
            screen.queryByTestId("lesson-exit-dialog"),
        ).not.toBeInTheDocument();
    });

    it("renders three actions when open", () => {
        setup();
        expect(screen.getByTestId("lesson-exit-dialog")).toBeInTheDocument();
        expect(screen.getByTestId("lesson-exit-pause")).toBeInTheDocument();
        expect(screen.getByTestId("lesson-exit-abandon")).toBeInTheDocument();
        expect(screen.getByTestId("lesson-exit-continue")).toBeInTheDocument();
    });

    it("Keep learning fires onContinue", () => {
        const {onContinue, onPause, onAbandon} = setup();
        fireEvent.click(screen.getByTestId("lesson-exit-continue"));
        expect(onContinue).toHaveBeenCalledTimes(1);
        expect(onPause).not.toHaveBeenCalled();
        expect(onAbandon).not.toHaveBeenCalled();
    });

    it("Pause fires onPause immediately (no confirm)", () => {
        const {onPause} = setup();
        fireEvent.click(screen.getByTestId("lesson-exit-pause"));
        expect(onPause).toHaveBeenCalledTimes(1);
    });

    it("Abandon opens a sub-confirm; OK fires onAbandon", () => {
        const {onAbandon} = setup();
        fireEvent.click(screen.getByTestId("lesson-exit-abandon"));
        // Sub-confirm now visible; main dialog is replaced.
        expect(
            screen.getByTestId("lesson-exit-confirm-abandon"),
        ).toBeInTheDocument();
        expect(onAbandon).not.toHaveBeenCalled();
        // Click the destructive confirm.
        fireEvent.click(screen.getByTestId("lesson-exit-confirm-ok"));
        expect(onAbandon).toHaveBeenCalledTimes(1);
    });

    it("Abandon sub-confirm cancel returns to main dialog", () => {
        const {onAbandon} = setup();
        fireEvent.click(screen.getByTestId("lesson-exit-abandon"));
        fireEvent.click(screen.getByTestId("lesson-exit-confirm-cancel"));
        // Main dialog visible again; no callback fired.
        expect(screen.getByTestId("lesson-exit-dialog")).toBeInTheDocument();
        expect(onAbandon).not.toHaveBeenCalled();
    });
});
