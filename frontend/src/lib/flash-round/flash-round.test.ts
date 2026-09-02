/**
 * Tests for the pure flash-round rules (#2888): the unlock condition
 * (every lesson of the set completed with at least one star) and the
 * deterministic selection of the most error-prone elements.
 */

import {describe, expect, it} from "vitest";

import {
    collectFlashRoundExercises,
    isFlashRoundUnlocked,
    selectFlashRoundErrors,
} from "./flash-round";
import type {
    ContentLesson,
    ElementError,
    LessonProgress,
} from "../../storage/types";

const SET = "language-fr-a1";

function progressRow(overrides: Partial<LessonProgress>): LessonProgress {
    return {
        id: "row",
        user_id: "u1",
        source: "owner/repo",
        set_id: SET,
        lesson_filename: "01.json",
        status: "completed",
        step_results: {},
        score_correct: 8,
        score_total: 10,
        time_spent_seconds: 60,
        started_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
        completed_at: "2026-09-01T00:00:00Z",
        paused_at: null,
        abandoned_at: null,
        ...overrides,
    };
}

function errorRow(overrides: Partial<ElementError>): ElementError {
    return {
        id: "err",
        user_id: "u1",
        set_id: SET,
        lesson_id: "01.json",
        exercise_id: "ex-1",
        element_key: "key-1",
        element_type: "vocabulary",
        user_answer: "",
        correct_answer: "",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-09-01T00:00:00Z",
        last_attempt_at: "2026-09-01T00:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
        ...overrides,
    } as ElementError;
}

describe("isFlashRoundUnlocked", () => {
    const lessons = ["01.json", "02.json"];

    it("unlocks when every lesson is completed with at least one star", () => {
        const progress = [
            progressRow({id: "a", lesson_filename: "01.json"}),
            progressRow({id: "b", lesson_filename: "02.json"}),
        ];
        expect(isFlashRoundUnlocked(lessons, progress, SET)).toBe(true);
    });

    it.each([
        [
            "a lesson is missing",
            [progressRow({id: "a", lesson_filename: "01.json"})],
        ],
        [
            "a lesson is only in progress",
            [
                progressRow({id: "a", lesson_filename: "01.json"}),
                progressRow({
                    id: "b",
                    lesson_filename: "02.json",
                    status: "in_progress",
                }),
            ],
        ],
        [
            "a lesson scored below one star",
            [
                progressRow({id: "a", lesson_filename: "01.json"}),
                progressRow({
                    id: "b",
                    lesson_filename: "02.json",
                    score_correct: 3,
                    score_total: 10,
                }),
            ],
        ],
    ] as const)("stays locked when %s", (_label, progress) => {
        expect(isFlashRoundUnlocked(lessons, [...progress], SET)).toBe(false);
    });

    it("ignores rows of other sets and stays locked for an empty set", () => {
        const progress = [
            progressRow({id: "a", lesson_filename: "01.json"}),
            progressRow({
                id: "x",
                lesson_filename: "02.json",
                set_id: "other-set",
            }),
        ];
        expect(isFlashRoundUnlocked(lessons, progress, SET)).toBe(false);
        expect(isFlashRoundUnlocked([], progress, SET)).toBe(false);
    });
});

describe("selectFlashRoundErrors", () => {
    it("ranks by error count, then attempts, then element key - capped", () => {
        const errors = [
            errorRow({id: "a", element_key: "b-key", error_count: 2}),
            errorRow({
                id: "b",
                element_key: "a-key",
                error_count: 5,
                attempt_count: 9,
            }),
            errorRow({id: "c", element_key: "c-key", error_count: 2}),
            errorRow({
                id: "d",
                element_key: "d-key",
                error_count: 5,
                attempt_count: 2,
            }),
        ];
        const picked = selectFlashRoundErrors(errors, 3);
        expect(picked.map((e) => e.element_key)).toEqual([
            "a-key",
            "d-key",
            "b-key",
        ]);
    });

    it("returns everything when fewer errors exist than requested", () => {
        const errors = [errorRow({id: "a"}), errorRow({id: "b"})];
        expect(selectFlashRoundErrors(errors, 10)).toHaveLength(2);
        expect(selectFlashRoundErrors([], 10)).toEqual([]);
    });
});

describe("collectFlashRoundExercises", () => {
    function lesson(
        id: string,
        exerciseIds: string[],
        cardIds: string[],
    ): ContentLesson {
        return {
            title: `Lesson ${id}`,
            steps: exerciseIds.map((exId, index) => ({
                id: `step-${exId}`,
                type: "exercise",
                exercise: {id: exId, type: "multiple_choice"},
                index,
            })),
            cards: cardIds.map((cardId) => ({
                id: cardId,
                front: cardId,
                back: `${cardId}-back`,
                tags: [],
            })),
        } as unknown as ContentLesson;
    }

    it("resolves each error's exercise from its source lesson, deduped", () => {
        const lessons = new Map([
            ["01.json", lesson("01", ["ex-1", "ex-2"], ["c1"])],
            ["02.json", lesson("02", ["ex-3"], ["c2"])],
        ]);
        const errors = [
            errorRow({id: "a", lesson_id: "01.json", exercise_id: "ex-2"}),
            errorRow({id: "b", lesson_id: "02.json", exercise_id: "ex-3"}),
            // Same exercise again (second element of it) - deduped.
            errorRow({
                id: "c",
                lesson_id: "01.json",
                exercise_id: "ex-2",
                element_key: "key-2",
            }),
            // Unresolvable references are skipped, never crash.
            errorRow({id: "d", lesson_id: "gone.json", exercise_id: "ex-9"}),
            errorRow({id: "e", lesson_id: "01.json", exercise_id: "ex-gone"}),
        ];
        const round = collectFlashRoundExercises(errors, lessons);
        expect(round.exercises.map((ex) => ex.id)).toEqual(["ex-2", "ex-3"]);
        expect(round.cards.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
    });

    it("returns empty collections for no errors", () => {
        const round = collectFlashRoundExercises([], new Map());
        expect(round.exercises).toEqual([]);
        expect(round.cards).toEqual([]);
    });
});
