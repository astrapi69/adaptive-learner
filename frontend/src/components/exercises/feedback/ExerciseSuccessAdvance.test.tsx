/**
 * ExerciseSuccessAdvance (#1218).
 *
 * The success-merge control shown in place of the redundant
 * "My answer" / "Solution" toggle once an exercise is answered
 * correctly: a success badge plus a single "Continue" action that
 * drives the lesson's forward navigation.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import ExerciseSuccessAdvance from "./ExerciseSuccessAdvance";
import {AutoAdvanceSuppressedProvider} from "./auto-advance-gate";
import {
    AUTO_ADVANCE_DELAY_MS,
    setLessonAutoAdvanceEnabled,
} from "../../../hooks/settings/useLessonAutoAdvance";

describe("ExerciseSuccessAdvance", () => {
    it("renders a success badge and a Continue button", () => {
        render(
            <ExerciseSuccessAdvance
                onAdvance={vi.fn()}
                testIdPrefix="word-tiles"
            />,
        );
        expect(
            screen.getByTestId("word-tiles-success-advance"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("word-tiles-advance")).toBeInTheDocument();
    });

    it("calls onAdvance when the Continue button is clicked", () => {
        const onAdvance = vi.fn();
        render(
            <ExerciseSuccessAdvance
                onAdvance={onAdvance}
                testIdPrefix="cloze"
            />,
        );
        fireEvent.click(screen.getByTestId("cloze-advance"));
        expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it("uses the provided advance label", () => {
        render(
            <ExerciseSuccessAdvance
                onAdvance={vi.fn()}
                label="Finish lesson"
                testIdPrefix="cloze"
            />,
        );
        expect(screen.getByTestId("cloze-advance")).toHaveTextContent(
            "Finish lesson",
        );
    });

    it("moves focus to the Continue button on mount (keyboard reach)", () => {
        render(
            <ExerciseSuccessAdvance
                onAdvance={vi.fn()}
                testIdPrefix="free-text"
            />,
        );
        expect(screen.getByTestId("free-text-advance")).toHaveFocus();
    });
});

describe("ExerciseSuccessAdvance auto-advance (#1330)", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        localStorage.clear();
    });

    it("does NOT auto-advance when the setting is off (default)", () => {
        const onAdvance = vi.fn();
        render(
            <ExerciseSuccessAdvance onAdvance={onAdvance} testIdPrefix="cloze" />,
        );
        vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS * 3);
        expect(onAdvance).not.toHaveBeenCalled();
    });

    it("auto-advances once after the delay when the setting is on", () => {
        setLessonAutoAdvanceEnabled(true);
        const onAdvance = vi.fn();
        render(
            <ExerciseSuccessAdvance onAdvance={onAdvance} testIdPrefix="cloze" />,
        );
        // Not yet — the success moment must be visible first.
        vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS - 50);
        expect(onAdvance).not.toHaveBeenCalled();
        vi.advanceTimersByTime(100);
        expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it("does not double-advance when clicked before the timer fires", () => {
        setLessonAutoAdvanceEnabled(true);
        const onAdvance = vi.fn();
        render(
            <ExerciseSuccessAdvance onAdvance={onAdvance} testIdPrefix="cloze" />,
        );
        fireEvent.click(screen.getByTestId("cloze-advance"));
        vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS * 2);
        expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it("cancels the pending auto-advance on unmount", () => {
        setLessonAutoAdvanceEnabled(true);
        const onAdvance = vi.fn();
        const {unmount} = render(
            <ExerciseSuccessAdvance onAdvance={onAdvance} testIdPrefix="cloze" />,
        );
        unmount();
        vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS * 2);
        expect(onAdvance).not.toHaveBeenCalled();
    });
});

describe("ExerciseSuccessAdvance auto-advance suppression (#1921)", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        localStorage.clear();
    });

    it("does NOT auto-advance a revisited step even with the setting on", () => {
        // Regression: Back-navigating onto a completed exercise re-mounts
        // this control; the timer must not fire so the Back button works.
        setLessonAutoAdvanceEnabled(true);
        const onAdvance = vi.fn();
        render(
            <AutoAdvanceSuppressedProvider suppressed={true}>
                <ExerciseSuccessAdvance onAdvance={onAdvance} testIdPrefix="cloze" />
            </AutoAdvanceSuppressedProvider>,
        );
        vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS * 3);
        expect(onAdvance).not.toHaveBeenCalled();
    });

    it("still allows a manual Continue click when suppressed", () => {
        setLessonAutoAdvanceEnabled(true);
        const onAdvance = vi.fn();
        render(
            <AutoAdvanceSuppressedProvider suppressed={true}>
                <ExerciseSuccessAdvance onAdvance={onAdvance} testIdPrefix="cloze" />
            </AutoAdvanceSuppressedProvider>,
        );
        fireEvent.click(screen.getByTestId("cloze-advance"));
        expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it("still auto-advances a fresh check when not suppressed", () => {
        setLessonAutoAdvanceEnabled(true);
        const onAdvance = vi.fn();
        render(
            <AutoAdvanceSuppressedProvider suppressed={false}>
                <ExerciseSuccessAdvance onAdvance={onAdvance} testIdPrefix="cloze" />
            </AutoAdvanceSuppressedProvider>,
        );
        vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS + 50);
        expect(onAdvance).toHaveBeenCalledTimes(1);
    });
});
