/**
 * SummaryExplanations pins (#2547).
 *
 * "Why you missed these" must show elements whose LAST attempt was
 * actually wrong, not merely "not yet SRS-mastered" (3 consecutive
 * correct answers, element-errors-dexie.ts MASTERY_THRESHOLD). Those
 * are different conditions: a freshly correct-but-not-yet-mastered
 * element has correct_streak >= 1, while an element whose most recent
 * attempt was wrong always has correct_streak === 0 (every correct
 * attempt increments the streak, every wrong one resets it to 0 -
 * applyScoreOutcome in element-errors-dexie.ts).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SummaryExplanations } from "./LessonSummarySections";
import type { ElementError } from "../../../storage/types";

const t = (_key: string, fallback?: string) => fallback ?? _key;

function makeError(overrides: Partial<ElementError>): ElementError {
    return {
        id: "e1",
        user_id: "u1",
        set_id: "es-a1",
        lesson_id: "lesson-1",
        exercise_id: "ex-1",
        element_key: "gracias",
        element_type: "vocabulary",
        user_answer: "gracias",
        correct_answer: "Gracias",
        error_count: 0,
        correct_streak: 1,
        last_error_at: null,
        last_attempt_at: "2026-08-10T00:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-08-10T00:00:00Z",
        updated_at: "2026-08-10T00:00:00Z",
        ...overrides,
    };
}

describe("SummaryExplanations", () => {
    it("does NOT show an element whose last attempt was correct, even though it isn't mastered yet", () => {
        // A case-insensitive-correct answer: correct_streak advanced to 1,
        // mastered stays false until the streak reaches 3.
        const errors = [
            makeError({
                element_key: "gracias",
                user_answer: "gracias",
                correct_answer: "Gracias",
                correct_streak: 1,
                mastered: false,
            }),
        ];
        render(<SummaryExplanations sessionErrors={errors} t={t} />);
        expect(
            screen.queryByTestId("lesson-summary-explanations"),
        ).not.toBeInTheDocument();
    });

    it("shows an element whose last attempt was actually wrong", () => {
        const errors = [
            makeError({
                element_key: "dias",
                user_answer: "Dias",
                correct_answer: "días",
                correct_streak: 0,
                error_count: 1,
                mastered: false,
            }),
        ];
        render(<SummaryExplanations sessionErrors={errors} t={t} />);
        expect(
            screen.getByTestId("lesson-summary-explanations"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId(`lesson-summary-explain-${errors[0].id}`),
        ).toBeInTheDocument();
    });

    it("excludes an already-correct element from a mixed list, keeping the genuinely wrong one", () => {
        const errors = [
            makeError({
                id: "e-correct",
                element_key: "buenos",
                user_answer: "Buenos",
                correct_answer: "Buenos",
                correct_streak: 2,
                mastered: false,
            }),
            makeError({
                id: "e-wrong",
                element_key: "hola",
                user_answer: "hola",
                correct_answer: "Hola",
                correct_streak: 0,
                error_count: 1,
                mastered: false,
            }),
        ];
        render(<SummaryExplanations sessionErrors={errors} t={t} />);
        expect(screen.getByTestId("lesson-summary-explain-e-wrong")).toBeInTheDocument();
        expect(
            screen.queryByTestId("lesson-summary-explain-e-correct"),
        ).not.toBeInTheDocument();
    });
});
