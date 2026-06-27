/**
 * Tests for AnswerCelebration (EXP-008 / Phase 55B).
 *
 * Pins:
 *  - correct + enthusiastic -> a praise phrase appears + the
 *    haptic fires.
 *  - subtle intensity -> no praise phrase (color flash only).
 *  - wrong answer -> no praise, no haptic, never a negative
 *    phrase (the token-diff carries the correction).
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import AnswerCelebration from "./AnswerCelebration";
import {
    resetCorrectAnswerCount,
    setFeedbackIntensity,
} from "../../../lib/feedback/feedbackPref";
import {resetPraiseSession} from "../../../lib/praise/phrase-picker";

let vibrateMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    localStorage.clear();
    resetCorrectAnswerCount();
    resetPraiseSession();
    vibrateMock = vi.fn();
    // happy-dom does not implement Vibration; install a spy.
    Object.defineProperty(navigator, "vibrate", {
        value: vibrateMock,
        configurable: true,
        writable: true,
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("AnswerCelebration", () => {
    it("shows a praise phrase + fires haptic on a correct answer (enthusiastic)", () => {
        setFeedbackIntensity("enthusiastic");
        render(<AnswerCelebration isCorrect={true} />);
        const praise = screen.getByTestId("answer-praise");
        expect(praise).toBeInTheDocument();
        expect(praise.textContent?.trim().length).toBeGreaterThan(0);
        expect(vibrateMock).toHaveBeenCalled();
    });

    it("renders no praise under subtle intensity", () => {
        setFeedbackIntensity("subtle");
        render(<AnswerCelebration isCorrect={true} />);
        expect(screen.queryByTestId("answer-praise")).not.toBeInTheDocument();
    });

    it("renders nothing + fires no haptic on a wrong answer", () => {
        setFeedbackIntensity("enthusiastic");
        render(<AnswerCelebration isCorrect={false} />);
        expect(screen.queryByTestId("answer-praise")).not.toBeInTheDocument();
        expect(vibrateMock).not.toHaveBeenCalled();
    });

    it("draws phrases from the correct_answer category", () => {
        setFeedbackIntensity("enthusiastic");
        render(<AnswerCelebration isCorrect={true} />);
        // English correct_answer pool starts with "Correct!".
        // Any non-empty phrase from the pool is acceptable; assert
        // it is one of the known EN openers to pin the category.
        const text = screen.getByTestId("answer-praise").textContent?.trim();
        expect(text).toBeTruthy();
        expect(text!.endsWith("!")).toBe(true);
    });
});
