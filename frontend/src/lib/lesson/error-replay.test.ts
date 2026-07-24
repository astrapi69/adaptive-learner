/**
 * collectFailedExercises / failedExerciseCount (error-replay).
 */

import {describe, expect, it} from "vitest";

import {
    collectFailedExercises,
    failedExerciseCount,
    narrowReplayExercises,
    openFailedExercises,
} from "./error-replay";
import type {
    ContentLesson,
    ContentLessonExercise,
    ElementError,
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

function err(
    exercise_id: string,
    overrides: Partial<ElementError> = {},
): ElementError {
    return {
        id: `${exercise_id}#e`,
        user_id: "u",
        set_id: "set",
        lesson_id: "01.json",
        exercise_id,
        element_key: "k",
        element_type: "text",
        user_answer: "",
        correct_answer: "",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-06-02T00:00:00Z",
        last_attempt_at: "2026-06-02T00:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-06-02T00:00:00Z",
        updated_at: "2026-06-02T00:00:00Z",
        ...overrides,
    };
}

describe("openFailedExercises (#1372)", () => {
    const FAILED = [ex("ex-a"), ex("ex-c")];

    it("keeps a failure whose element is still open (streak 0, not mastered)", () => {
        const errors = [err("ex-a"), err("ex-c")];
        expect(openFailedExercises(FAILED, errors).map((e) => e.id)).toEqual([
            "ex-a",
            "ex-c",
        ]);
    });

    it("drops a failure corrected in a replay (streak advanced)", () => {
        // ex-a answered correctly once → correct_streak 1 → resolved.
        const errors = [err("ex-a", {correct_streak: 1}), err("ex-c")];
        expect(openFailedExercises(FAILED, errors).map((e) => e.id)).toEqual([
            "ex-c",
        ]);
    });

    it("drops a failure whose element became mastered", () => {
        const errors = [
            err("ex-a", {mastered: true, correct_streak: 3}),
            err("ex-c"),
        ];
        expect(openFailedExercises(FAILED, errors).map((e) => e.id)).toEqual([
            "ex-c",
        ]);
    });

    it("returns empty when every failure is corrected (→ all-corrected)", () => {
        const errors = [
            err("ex-a", {correct_streak: 2}),
            err("ex-c", {mastered: true, correct_streak: 3}),
        ];
        expect(openFailedExercises(FAILED, errors)).toEqual([]);
    });

    it("keeps an exercise with a still-open element even if another is fixed", () => {
        // ex-c has two element rows: one corrected, one still open → keep.
        const errors = [
            err("ex-a", {correct_streak: 1}),
            err("ex-c", {element_key: "k1", correct_streak: 2}),
            err("ex-c", {element_key: "k2", correct_streak: 0}),
        ];
        expect(openFailedExercises(FAILED, errors).map((e) => e.id)).toEqual([
            "ex-c",
        ]);
    });

    it("keeps a failure with no element rows yet (conservative)", () => {
        expect(openFailedExercises(FAILED, []).map((e) => e.id)).toEqual([
            "ex-a",
            "ex-c",
        ]);
    });
});

function matching(
    id: string,
    pairs: {left: string; right: string}[],
): ContentLessonExercise {
    return {
        id,
        type: "matching",
        prompt: `match ${id}`,
        card_ids: [],
        distractors: [],
        pairs,
    } as unknown as ContentLessonExercise;
}

const FOUR_PAIRS = [
    {left: "a", right: "A"},
    {left: "b", right: "B"},
    {left: "c", right: "C"},
    {left: "d", right: "D"},
];

describe("narrowReplayExercises (#1874)", () => {
    it("4 pairs, 1 wrong → wrong pair + one filler to MIN_PAIRS, not all 4", () => {
        const mx = matching("mx", FOUR_PAIRS);
        // Only pair "b" (element_key = left) is still wrong.
        const errors = [
            err("mx", {element_key: "a", correct_streak: 2}),
            err("mx", {element_key: "b", correct_streak: 0}),
            err("mx", {element_key: "c", mastered: true, correct_streak: 3}),
            err("mx", {element_key: "d", correct_streak: 1}),
        ];
        const [out] = narrowReplayExercises([mx], errors);
        expect(out.pairs).toHaveLength(2); // MATCHING_MIN_PAIRS
        expect(out.pairs?.map((p) => p.left)).toContain("b"); // the wrong one
    });

    it("4 pairs, 3 wrong → exactly the 3 wrong pairs, no fill", () => {
        const mx = matching("mx", FOUR_PAIRS);
        const errors = [
            err("mx", {element_key: "a", correct_streak: 0}),
            err("mx", {element_key: "b", correct_streak: 0}),
            err("mx", {element_key: "c", correct_streak: 0}),
            err("mx", {element_key: "d", correct_streak: 2}), // corrected
        ];
        const [out] = narrowReplayExercises([mx], errors);
        expect(out.pairs?.map((p) => p.left).sort()).toEqual(["a", "b", "c"]);
    });

    it("errorsOnly=false replays the WHOLE set (all pairs)", () => {
        const mx = matching("mx", FOUR_PAIRS);
        const errors = [err("mx", {element_key: "b", correct_streak: 0})];
        const [out] = narrowReplayExercises([mx], errors, {errorsOnly: false});
        expect(out.pairs).toHaveLength(4);
    });

    it("free-text / cloze pass through unchanged (regression)", () => {
        const ft = ex("ex-a"); // free_text with no pairs
        const errors = [err("ex-a", {element_key: "k", correct_streak: 0})];
        const [out] = narrowReplayExercises([ft], errors);
        expect(out).toBe(ft); // identity - untouched
    });

    it("keeps a matching exercise whole when all pairs are wrong", () => {
        const mx = matching("mx", FOUR_PAIRS);
        const errors = FOUR_PAIRS.map((p) =>
            err("mx", {element_key: p.left, correct_streak: 0}),
        );
        const [out] = narrowReplayExercises([mx], errors);
        expect(out.pairs).toHaveLength(4);
    });

    it("keeps a matching exercise whole when there is no wrong-key signal", () => {
        const mx = matching("mx", FOUR_PAIRS);
        const [out] = narrowReplayExercises([mx], []);
        expect(out).toBe(mx);
    });
});
