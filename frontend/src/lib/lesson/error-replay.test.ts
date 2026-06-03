/**
 * collectFailedExercises / failedExerciseCount (error-replay).
 */

import {describe, expect, it} from "vitest";

import {collectFailedExercises, failedExerciseCount} from "./error-replay";
import type {
    ContentLesson,
    ContentLessonExercise,
    LessonProgress,
} from "../../storage/types";

function ex(id: string): ContentLessonExercise {
    return {
        id,
        type: "free_text",
        prompt: `prompt ${id}`,
        card_ids: [],
        accept: ["x"],
        distractors: [],
    };
}

const LESSON = {
    id: "01",
    title: "L",
    estimated_minutes: 5,
    cards: [],
    steps: [
        {id: "theory-1", type: "theory", body: "..."},
        {id: "ex-a", type: "exercise", exercise: ex("ex-a")},
        {id: "ex-b", type: "exercise", exercise: ex("ex-b")},
        {id: "ex-c", type: "exercise", exercise: ex("ex-c")},
    ],
} as unknown as ContentLesson;

function progress(
    results: Record<string, {correct: number; total: number}>,
): LessonProgress {
    const step_results: LessonProgress["step_results"] = {};
    for (const [id, r] of Object.entries(results)) {
        step_results[id] = {
            correct: r.correct,
            total: r.total,
            attempts: 1,
            completed_at: "2026-06-02T00:00:00Z",
        };
    }
    return {
        id: "p",
        user_id: "u",
        source: "s",
        set_id: "set",
        lesson_filename: "01.json",
        status: "completed",
        step_results,
        score_correct: 0,
        score_total: 0,
        time_spent_seconds: 0,
        started_at: "2026-06-02T00:00:00Z",
        updated_at: "2026-06-02T00:00:00Z",
        completed_at: "2026-06-02T00:00:00Z",
        paused_at: null,
        abandoned_at: null,
    };
}

describe("collectFailedExercises", () => {
    it("returns only the exercises scored below full, in lesson order", () => {
        const p = progress({
            "ex-a": {correct: 0, total: 1}, // failed
            "ex-b": {correct: 1, total: 1}, // aced
            "ex-c": {correct: 1, total: 3}, // partial -> failed
        });
        const failed = collectFailedExercises(LESSON, p);
        expect(failed.map((e) => e.id)).toEqual(["ex-a", "ex-c"]);
    });

    it("skips theory steps and unattempted exercises", () => {
        // Only ex-a has a result; ex-b/ex-c untouched.
        const p = progress({"ex-a": {correct: 0, total: 1}});
        expect(collectFailedExercises(LESSON, p).map((e) => e.id)).toEqual([
            "ex-a",
        ]);
    });

    it("returns empty on a perfect run", () => {
        const p = progress({
            "ex-a": {correct: 1, total: 1},
            "ex-b": {correct: 1, total: 1},
            "ex-c": {correct: 3, total: 3},
        });
        expect(collectFailedExercises(LESSON, p)).toEqual([]);
        expect(failedExerciseCount(LESSON, p)).toBe(0);
    });

    it("returns empty when there's no progress", () => {
        expect(collectFailedExercises(LESSON, null)).toEqual([]);
        expect(failedExerciseCount(LESSON, null)).toBe(0);
    });

    it("failedExerciseCount counts the failed exercises", () => {
        const p = progress({
            "ex-a": {correct: 0, total: 1},
            "ex-b": {correct: 0, total: 2},
            "ex-c": {correct: 1, total: 1},
        });
        expect(failedExerciseCount(LESSON, p)).toBe(2);
    });
});
