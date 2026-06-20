/**
 * Tests for the Dexie-mode lesson-progress store
 * (Phase 44 / EXP-002 / P-109).
 *
 * Pins the upsert + merge contract end-to-end against
 * fake-indexeddb. Mirrors the backend test shapes 1:1 so a
 * future Phase 46 SRS integration can rely on parity.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {
    getLessonProgressDexie,
    listLessonProgressDexie,
    upsertLessonProgressDexie,
} from "./lesson-progress-dexie";
import {_resetDbForTests, getDb} from "./dexie/db";

const USER = "user-1";
const SOURCE = "astrapi69/adaptive-learner-content";
const SET_ID = "language-fr-a1";
const LESSON = "01-greetings.json";

beforeEach(async () => {
    const db = getDb();
    try {
        await db.lessonProgress.clear();
    } catch {
        /* fresh DB */
    }
    await _resetDbForTests();
});

describe("Dexie lessonProgress: list + get on empty DB", () => {
    it("list returns empty for a fresh user", async () => {
        const rows = await listLessonProgressDexie(USER);
        expect(rows).toEqual([]);
    });

    it("get returns null when no row exists", async () => {
        const row = await getLessonProgressDexie(
            USER,
            SOURCE,
            SET_ID,
            LESSON,
        );
        expect(row).toBeNull();
    });
});

describe("Dexie lessonProgress: upsert", () => {
    it("creates a new row on first call", async () => {
        const row = await upsertLessonProgressDexie(USER, {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            step_result: {
                step_id: "ex-match-greetings",
                correct: 4,
                total: 4,
            },
            time_spent_seconds_delta: 30,
        });
        expect(row.status).toBe("in_progress");
        expect(row.score_correct).toBe(4);
        expect(row.score_total).toBe(4);
        expect(row.time_spent_seconds).toBe(30);
        expect(row.step_results["ex-match-greetings"].correct).toBe(4);
        expect(row.completed_at).toBeNull();
    });

    it("merges step results across calls", async () => {
        await upsertLessonProgressDexie(USER, {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            step_result: {step_id: "step-1", correct: 1, total: 1},
            time_spent_seconds_delta: 20,
        });
        const row = await upsertLessonProgressDexie(USER, {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            step_result: {
                step_id: "step-2",
                correct: 0,
                total: 1,
                attempts: 2,
            },
            time_spent_seconds_delta: 45,
        });
        expect(Object.keys(row.step_results).sort()).toEqual([
            "step-1",
            "step-2",
        ]);
        expect(row.score_correct).toBe(1);
        expect(row.score_total).toBe(2);
        expect(row.time_spent_seconds).toBe(65);
    });

    it("replaces the same step's result on re-record", async () => {
        await upsertLessonProgressDexie(USER, {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            step_result: {step_id: "step-1", correct: 2, total: 4},
        });
        const row = await upsertLessonProgressDexie(USER, {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            step_result: {
                step_id: "step-1",
                correct: 4,
                total: 4,
                attempts: 2,
            },
        });
        expect(row.score_correct).toBe(4);
        expect(row.score_total).toBe(4);
        expect(row.step_results["step-1"].attempts).toBe(2);
    });

    it("round-trips the raw_answer (BUG P1 / Problem 2)", async () => {
        await upsertLessonProgressDexie(USER, {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            step_result: {
                step_id: "ex-cloze",
                correct: 1,
                total: 1,
                raw_answer: {kind: "cloze", inputs: ["hablo"]},
            },
        });
        const row = await getLessonProgressDexie(
            USER,
            SOURCE,
            SET_ID,
            LESSON,
        );
        expect(row!.step_results["ex-cloze"].raw_answer).toEqual({
            kind: "cloze",
            inputs: ["hablo"],
        });
    });

    it("omits raw_answer when none is provided (legacy shape)", async () => {
        await upsertLessonProgressDexie(USER, {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            step_result: {step_id: "step-1", correct: 1, total: 1},
        });
        const row = await getLessonProgressDexie(
            USER,
            SOURCE,
            SET_ID,
            LESSON,
        );
        expect(row!.step_results["step-1"].raw_answer).toBeUndefined();
    });

    it("flips status to completed on mark_completed", async () => {
        await upsertLessonProgressDexie(USER, {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            step_result: {step_id: "step-1", correct: 1, total: 1},
        });
        const row = await upsertLessonProgressDexie(USER, {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            mark_completed: true,
        });
        expect(row.status).toBe("completed");
        expect(row.completed_at).not.toBeNull();
    });

    it("scopes rows per user", async () => {
        await upsertLessonProgressDexie("user-A", {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            step_result: {step_id: "s", correct: 1, total: 1},
        });
        await upsertLessonProgressDexie("user-B", {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            step_result: {step_id: "s", correct: 0, total: 1},
        });
        const a = await listLessonProgressDexie("user-A");
        const b = await listLessonProgressDexie("user-B");
        expect(a).toHaveLength(1);
        expect(b).toHaveLength(1);
        expect(a[0].score_correct).toBe(1);
        expect(b[0].score_correct).toBe(0);
    });
});
