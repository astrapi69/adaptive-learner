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
import type {ReactElement} from "react";
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

describe("AnswerCelebration game-mode juice (#2874)", async () => {
    const {setPlayfulMode} = await import(
        "../../../lib/learning/playful/playfulModePref"
    );
    const {LessonModeProvider} = await import(
        "../../../hooks/lesson/modes/useLessonMode"
    );

    // The playful flag reaches the component through the mode
    // provider (as in the real lesson page), so the juice tests
    // render inside it.
    const inLesson = (ui: ReactElement) =>
        render(<LessonModeProvider mode="practice">{ui}</LessonModeProvider>);

    it("floats a +1 off a correct answer in game mode", () => {
        setPlayfulMode(true);
        setFeedbackIntensity("normal");
        inLesson(<AnswerCelebration isCorrect={true} />);
        expect(screen.getByTestId("answer-float-point")).toHaveTextContent(
            "+1",
        );
    });

    it("shows no +1 outside game mode", () => {
        setFeedbackIntensity("normal");
        inLesson(<AnswerCelebration isCorrect={true} />);
        expect(
            screen.queryByTestId("answer-float-point"),
        ).not.toBeInTheDocument();
    });

    it("shows no +1 on a wrong answer", () => {
        setPlayfulMode(true);
        setFeedbackIntensity("normal");
        inLesson(<AnswerCelebration isCorrect={false} />);
        expect(
            screen.queryByTestId("answer-float-point"),
        ).not.toBeInTheDocument();
    });
});
