/**
 * Tests for the endless-mode stream builder (#1015): the opening queue
 * orders due/error exercises first then new ones, the pool covers every
 * exercise, and endlessStepAt walks the queue then repeats randomly
 * without finishing.
 */

import {describe, expect, it} from "vitest";

import {
    buildEndlessPlan,
    endlessStepAt,
    type EndlessSourceLesson,
} from "./endless-stream";
import type {
    ContentLesson,
    ContentLessonExercise,
} from "../../storage/types";

function exercise(id: string): ContentLessonExercise {
    return {
        id,
        type: "free_text",
        prompt: `Prompt ${id}`,
        card_ids: [id],
        accept: ["x"],
        distractors: [],
    };
}

function lesson(id: string, exerciseIds: string[]): ContentLesson {
    return {
        id,
        title: `Lesson ${id}`,
        estimated_minutes: 5,
        cards: [],
        steps: exerciseIds.map((exId) => ({
            id: `step-${exId}`,
            type: "exercise" as const,
            exercise: exercise(exId),
        })),
    };
}

function source(lessonId: string, exerciseIds: string[]): EndlessSourceLesson {
    return {lessonId, title: lessonId, lesson: lesson(lessonId, exerciseIds)};
}

describe("buildEndlessPlan", () => {
    const sources = [source("l1", ["a", "b", "c"]), source("l2", ["d", "e"])];

    it("pools every supported exercise, source-tagged", () => {
        const plan = buildEndlessPlan({
            sources,
            dueExerciseIds: [],
            seenExerciseIds: new Set(),
        });
        expect(plan.pool).toHaveLength(5);
        expect(plan.pool.every((s) => s.review_lesson_id)).toBe(true);
        expect(plan.pool.map((s) => s.exercise?.id).sort()).toEqual([
            "a",
            "b",
            "c",
            "d",
            "e",
        ]);
    });

    it("orders due exercises first (in the given priority order)", () => {
        const plan = buildEndlessPlan({
            sources,
            dueExerciseIds: ["d", "a"],
            seenExerciseIds: new Set(["a", "b", "c", "d", "e"]),
        });
        // due tier: d, a (priority order); no new (all seen).
        expect(plan.dueCount).toBe(2);
        expect(plan.newCount).toBe(0);
        expect(plan.queue.map((s) => s.exercise?.id)).toEqual(["d", "a"]);
    });

    it("puts new (unseen) exercises after the due tier", () => {
        const plan = buildEndlessPlan({
            sources,
            dueExerciseIds: ["a"],
            seenExerciseIds: new Set(["a", "b"]),
        });
        // due: a; new: c, d, e (b is seen-but-not-due → only in random phase).
        expect(plan.queue.map((s) => s.exercise?.id)).toEqual([
            "a",
            "c",
            "d",
            "e",
        ]);
        expect(plan.dueCount).toBe(1);
        expect(plan.newCount).toBe(3);
    });

    it("ignores a due id that isn't in any lesson", () => {
        const plan = buildEndlessPlan({
            sources,
            dueExerciseIds: ["ghost", "a"],
            seenExerciseIds: new Set(["a", "b", "c", "d", "e"]),
        });
        expect(plan.queue.map((s) => s.exercise?.id)).toEqual(["a"]);
    });
});

describe("endlessStepAt", () => {
    const sources = [source("l1", ["a", "b"]), source("l2", ["c"])];
    const plan = buildEndlessPlan({
        sources,
        dueExerciseIds: ["c"],
        seenExerciseIds: new Set(["a", "b", "c"]),
    });

    it("walks the opening queue by index", () => {
        // queue is just [c] (all seen, only c due); pool has a,b,c.
        expect(endlessStepAt(plan, 0, null)?.exercise?.id).toBe("c");
    });

    it("never returns null once there is content (random repetition)", () => {
        for (let i = 1; i < 12; i++) {
            const step = endlessStepAt(plan, i, null, () => 0);
            expect(step).not.toBeNull();
        }
    });

    it("avoids an immediate repeat of the last step in the random phase", () => {
        // rng=0 would pick pool[0]; if that equals lastStepId, it advances.
        const first = plan.pool[0];
        const step = endlessStepAt(plan, 5, first.id, () => 0);
        expect(step?.id).not.toBe(first.id);
    });

    it("returns null only when there is no content", () => {
        const empty = buildEndlessPlan({
            sources: [],
            dueExerciseIds: [],
            seenExerciseIds: new Set(),
        });
        expect(endlessStepAt(empty, 0, null)).toBeNull();
    });
});
