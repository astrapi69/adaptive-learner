/**
 * statistics/summary unit tests (#582).
 *
 * Pins the pure aggregation contract behind the Learning Statistics
 * page: pooled accuracy, the dense activity series, weak-area ranking,
 * and the per-pair / per-level grouping.
 */

import {describe, expect, it} from "vitest";

import {
    buildLessonActivity,
    computeOverview,
    progressByPair,
    topWeakAreas,
} from "./summary";
import type {ElementError, LessonProgress} from "../../storage/types";
import type {PersonalPathSet} from "../learning-path/personal-path";

function lp(over: Partial<LessonProgress>): LessonProgress {
    return {
        id: "id",
        user_id: "u",
        source: "bundled",
        set_id: "es-a1",
        lesson_filename: "01.json",
        status: "completed",
        step_results: {},
        score_correct: 0,
        score_total: 0,
        time_spent_seconds: 0,
        started_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        completed_at: null,
        paused_at: null,
        abandoned_at: null,
        ...over,
    } as LessonProgress;
}

function ee(over: Partial<ElementError>): ElementError {
    return {
        id: "e",
        user_id: "u",
        set_id: "es-a1",
        lesson_id: "01.json",
        exercise_id: "ex1",
        element_key: "el libro",
        element_type: "card",
        user_answer: "la libro",
        correct_answer: "el libro",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-01-02T00:00:00Z",
        last_attempt_at: "2026-01-02T00:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
        ...over,
    } as ElementError;
}

function pset(over: Partial<PersonalPathSet>): PersonalPathSet {
    return {
        source: "bundled",
        setId: "es-a1",
        title: "Spanish A1",
        titleNative: null,
        domain: "language",
        sourceLanguage: "de",
        targetLanguage: "es",
        level: "a1",
        lessons: [],
        completedCount: 0,
        totalCount: 0,
        percentComplete: 0,
        lastActivity: null,
        currentLesson: null,
        mode: "start",
        errorCount: 0,
        nextLevel: null,
        ...over,
    } as PersonalPathSet;
}

describe("computeOverview", () => {
    it("pools accuracy by volume and sums time + completions", () => {
        const result = computeOverview([
            lp({status: "completed", score_correct: 9, score_total: 10, time_spent_seconds: 120}),
            lp({status: "completed", score_correct: 1, score_total: 10, time_spent_seconds: 60}),
            lp({status: "in_progress", score_correct: 0, score_total: 0, time_spent_seconds: 30}),
        ]);
        expect(result.completedLessons).toBe(2);
        expect(result.attemptedLessons).toBe(2);
        expect(result.totalTimeSeconds).toBe(210);
        // pooled: (9+1) / (10+10) = 50%
        expect(result.averageAccuracy).toBe(50);
    });

    it("returns null accuracy when nothing scored", () => {
        expect(computeOverview([]).averageAccuracy).toBeNull();
        expect(computeOverview([lp({score_total: 0})]).averageAccuracy).toBeNull();
    });
});

describe("buildLessonActivity", () => {
    const today = new Date("2026-03-10T12:00:00Z");

    it("produces a dense series of the requested length ending today", () => {
        const series = buildLessonActivity([], 90, today);
        expect(series).toHaveLength(90);
        expect(series[89].date).toBe("2026-03-10");
        expect(series[0].date).toBe("2025-12-11");
        expect(series.every((d) => d.count === 0)).toBe(true);
    });

    it("counts completed lessons per UTC day, ignoring non-completed", () => {
        const series = buildLessonActivity(
            [
                lp({status: "completed", completed_at: "2026-03-09T08:00:00Z"}),
                lp({status: "completed", completed_at: "2026-03-09T20:00:00Z"}),
                lp({status: "in_progress", updated_at: "2026-03-09T09:00:00Z"}),
            ],
            5,
            today,
        );
        const mar9 = series.find((d) => d.date === "2026-03-09");
        expect(mar9?.count).toBe(2);
    });
});

describe("topWeakAreas", () => {
    it("ranks unmastered first, then by error count, and caps at the limit", () => {
        const result = topWeakAreas(
            [
                ee({element_key: "a", error_count: 2, mastered: false}),
                ee({element_key: "b", error_count: 9, mastered: true}),
                ee({element_key: "c", error_count: 5, mastered: false}),
                ee({element_key: "d", error_count: 0, mastered: false}),
            ],
            10,
        );
        // d dropped (0 errors); unmastered c(5) > a(2) > then mastered b(9)
        expect(result.map((w) => w.elementKey)).toEqual(["c", "a", "b"]);
        expect(result[0].lastAnswer).toBe("la libro");
    });

    it("honours the limit", () => {
        const many = Array.from({length: 15}, (_, i) =>
            ee({element_key: `k${i}`, error_count: i + 1}),
        );
        expect(topWeakAreas(many, 10)).toHaveLength(10);
    });
});

describe("progressByPair", () => {
    it("groups by source→target and splits levels in CEFR order", () => {
        const result = progressByPair([
            pset({sourceLanguage: "de", targetLanguage: "es", level: "a2", completedCount: 5, totalCount: 10}),
            pset({sourceLanguage: "de", targetLanguage: "es", level: "a1", completedCount: 10, totalCount: 10}),
            pset({sourceLanguage: "de", targetLanguage: "fr", level: "a1", completedCount: 0, totalCount: 5}),
        ]);
        expect(result).toHaveLength(2);
        const esPair = result.find((p) => p.target === "es")!;
        expect(esPair.percent).toBe(75); // 15/20
        expect(esPair.levels.map((l) => l.level)).toEqual(["a1", "a2"]);
        expect(esPair.levels[0].percent).toBe(100);
        expect(esPair.levels[1].percent).toBe(50);
        // ordered by target: es before fr
        expect(result.map((p) => p.target)).toEqual(["es", "fr"]);
    });
});
