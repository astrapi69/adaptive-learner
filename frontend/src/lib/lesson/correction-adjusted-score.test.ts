/**
 * Tests for the correction-adjusted lesson score (#2479).
 *
 * The main lesson run freezes ``score_correct/score_total`` at grading
 * time; the end-of-lesson correction round advances SRS ``ElementError``
 * rows but never lifts that number. These helpers derive the FINAL,
 * post-correction view the summary shows: an immediate segment, a
 * corrected segment, and the star-driving final count.
 */

import {describe, expect, it} from "vitest";

import type {ElementError, LessonProgress} from "../../storage/types";
import {
    countCorrectedElements,
    deriveCorrectionAdjustedScore,
} from "./correction-adjusted-score";

/** Minimal ElementError row builder — only the fields the helper reads. */
function row(
    partial: Partial<ElementError> & {error_count: number; correct_streak: number},
): ElementError {
    return {
        id: "id",
        user_id: "u",
        set_id: "s",
        lesson_id: "l",
        exercise_id: "e",
        element_key: "k",
        element_type: "vocabulary",
        user_answer: "",
        correct_answer: "",
        last_error_at: null,
        last_attempt_at: "2026-08-06T00:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-08-06T00:00:00Z",
        updated_at: "2026-08-06T00:00:00Z",
        ...partial,
    };
}

function progress(
    scoreCorrect: number,
    scoreTotal: number,
): LessonProgress {
    return {
        id: "p",
        user_id: "u",
        source: "src",
        set_id: "s",
        lesson_filename: "l",
        status: "completed",
        lesson_mode: "practice",
        step_results: {},
        score_correct: scoreCorrect,
        score_total: scoreTotal,
        time_spent_seconds: 60,
        current_step: 0,
        started_at: "2026-08-06T00:00:00Z",
        updated_at: "2026-08-06T00:00:00Z",
        completed_at: "2026-08-06T00:00:00Z",
        paused_at: null,
        abandoned_at: null,
        attempts: 1,
        best_score_correct: 0,
        best_score_total: 0,
        attempt_history: [],
    };
}

describe("countCorrectedElements", () => {
    it("counts an erred element that is now on a positive streak", () => {
        const rows = [row({error_count: 1, correct_streak: 1})];
        expect(countCorrectedElements(rows, 4)).toBe(1);
    });

    it("counts an erred element that is now mastered", () => {
        const rows = [row({error_count: 2, correct_streak: 3, mastered: true})];
        expect(countCorrectedElements(rows, 4)).toBe(1);
    });

    it("does not count a still-wrong element (streak 0, not mastered)", () => {
        const rows = [row({error_count: 1, correct_streak: 0})];
        expect(countCorrectedElements(rows, 4)).toBe(0);
    });

    it("does not count a first-try-correct element (never erred)", () => {
        const rows = [row({error_count: 0, correct_streak: 1})];
        expect(countCorrectedElements(rows, 4)).toBe(0);
    });

    it("caps the count at the run's wrong-element count", () => {
        const rows = [
            row({error_count: 1, correct_streak: 1}),
            row({error_count: 1, correct_streak: 1}),
            row({error_count: 1, correct_streak: 2}),
        ];
        // Only 2 were wrong this run — a stale prior-run resolved row must
        // never push corrected past wrongInRun.
        expect(countCorrectedElements(rows, 2)).toBe(2);
    });

    it("returns 0 when there is no wrong element in the run", () => {
        const rows = [row({error_count: 1, correct_streak: 1})];
        expect(countCorrectedElements(rows, 0)).toBe(0);
    });

    it("returns 0 for an empty row set (no positive evidence)", () => {
        expect(countCorrectedElements([], 4)).toBe(0);
    });
});

describe("deriveCorrectionAdjustedScore", () => {
    it("lifts the final count when errors were corrected", () => {
        // 10/16 immediate; 6 wrong, all 6 corrected.
        const rows = Array.from({length: 6}, () =>
            row({error_count: 1, correct_streak: 1}),
        );
        const result = deriveCorrectionAdjustedScore(progress(10, 16), rows);
        expect(result.immediateCorrect).toBe(10);
        expect(result.correctedCount).toBe(6);
        expect(result.finalCorrect).toBe(16);
        expect(result.total).toBe(16);
        expect(result.finalPct).toBe(100);
        expect(result.immediatePct).toBe(63);
        expect(result.remaining).toBe(0);
        expect(result.hasCorrections).toBe(true);
    });

    it("partial correction lifts the count part-way", () => {
        // 10/16 immediate; 6 wrong, 3 corrected.
        const rows = [
            ...Array.from({length: 3}, () =>
                row({error_count: 1, correct_streak: 1}),
            ),
            ...Array.from({length: 3}, () =>
                row({error_count: 1, correct_streak: 0}),
            ),
        ];
        const result = deriveCorrectionAdjustedScore(progress(10, 16), rows);
        expect(result.correctedCount).toBe(3);
        expect(result.finalCorrect).toBe(13);
        expect(result.finalPct).toBe(81);
        expect(result.remaining).toBe(3);
        expect(result.hasCorrections).toBe(true);
    });

    it("no corrections yet: single-segment (final === immediate)", () => {
        const rows = Array.from({length: 6}, () =>
            row({error_count: 1, correct_streak: 0}),
        );
        const result = deriveCorrectionAdjustedScore(progress(10, 16), rows);
        expect(result.correctedCount).toBe(0);
        expect(result.finalCorrect).toBe(10);
        expect(result.finalPct).toBe(63);
        expect(result.hasCorrections).toBe(false);
    });

    it("perfect run: no wrong elements, no corrections", () => {
        const result = deriveCorrectionAdjustedScore(progress(16, 16), []);
        expect(result.immediateCorrect).toBe(16);
        expect(result.correctedCount).toBe(0);
        expect(result.finalCorrect).toBe(16);
        expect(result.finalPct).toBe(100);
        expect(result.hasCorrections).toBe(false);
    });

    it("never exceeds the total even with stale resolved rows", () => {
        const rows = Array.from({length: 20}, () =>
            row({error_count: 1, correct_streak: 2}),
        );
        const result = deriveCorrectionAdjustedScore(progress(10, 16), rows);
        expect(result.finalCorrect).toBe(16);
        expect(result.correctedCount).toBe(6);
        expect(result.remaining).toBe(0);
    });

    it("handles a null progress row (unscored)", () => {
        const result = deriveCorrectionAdjustedScore(null, []);
        expect(result.total).toBe(0);
        expect(result.finalCorrect).toBe(0);
        expect(result.finalPct).toBe(0);
        expect(result.hasCorrections).toBe(false);
    });
});
