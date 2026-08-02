/**
 * Tests for the test-mode pure helpers (#2319).
 */

import {afterEach, describe, expect, it, vi} from "vitest";

import {forceCorrect, isTestModeAvailable} from "./test-mode";
import type {ExerciseScored} from "../../components/exercises/shell/exercise-control";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("isTestModeAvailable", () => {
    it("is false when VITE_TEST_MODE is unset (the regular build)", () => {
        vi.stubEnv("VITE_TEST_MODE", "");
        expect(isTestModeAvailable()).toBe(false);
    });

    it("is true for VITE_TEST_MODE=true / 1", () => {
        vi.stubEnv("VITE_TEST_MODE", "true");
        expect(isTestModeAvailable()).toBe(true);
        vi.stubEnv("VITE_TEST_MODE", "1");
        expect(isTestModeAvailable()).toBe(true);
    });

    it("is false for any other value", () => {
        vi.stubEnv("VITE_TEST_MODE", "yes");
        expect(isTestModeAvailable()).toBe(false);
    });
});

describe("forceCorrect", () => {
    const wrong: ExerciseScored = {
        correct: 0,
        total: 3,
        attempts: [
            {
                set_id: "s",
                lesson_id: "l",
                exercise_id: "e",
                direction: "source_to_target",
                element_key: "k",
                element_type: "vocabulary",
                user_answer: "nonsense",
                correct_answer: "right",
                correct: false,
            },
        ],
        raw_answer: {kind: "free_text", value: "nonsense"} as never,
    };

    it("lifts the aggregate to fully correct", () => {
        const out = forceCorrect(wrong);
        expect(out.correct).toBe(out.total);
        expect(out.total).toBe(3);
    });

    it("marks every attempt correct", () => {
        const out = forceCorrect(wrong);
        expect(out.attempts.every((a) => a.correct)).toBe(true);
    });

    it("does not mutate the input", () => {
        forceCorrect(wrong);
        expect(wrong.correct).toBe(0);
        expect(wrong.attempts[0].correct).toBe(false);
    });

    it("preserves the raw answer", () => {
        expect(forceCorrect(wrong).raw_answer).toBe(wrong.raw_answer);
    });
});
