/**
 * Dexie twin of backend ``test_lesson_progress_recent_steps.py`` (#3365):
 * the last ten learner actions on a lesson row, same rules in both
 * storage modes.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {upsertLessonProgressDexie} from "./lesson-progress-dexie";
import {_resetDbForTests, getDb} from "../dexie/db";
import type {LessonProgressUpsertBody, LessonStepEvent} from "../types";

const USER = "user-1";
const IDENTITY = {
    source: "astrapi69/adaptive-learner-content",
    set_id: "language-fr-a1",
    lesson_filename: "01-greetings.json",
};

const upsert = (extra: Partial<LessonProgressUpsertBody> = {}) =>
    upsertLessonProgressDexie(USER, {...IDENTITY, ...extra});

const step = (index: number): LessonStepEvent => ({
    kind: "step",
    step_index: index,
    step_id: `s${index}`,
});

beforeEach(async () => {
    const db = getDb();
    try {
        await db.lessonProgress.clear();
    } catch {
        /* fresh DB */
    }
    await _resetDbForTests();
});

describe("Dexie lessonProgress: recent_steps (#3365)", () => {
    it("records a step event with a timestamp", async () => {
        const row = await upsert({current_step: 2, step_event: step(2)});
        expect(row.recent_steps).toHaveLength(1);
        expect(row.recent_steps?.[0]).toMatchObject({
            kind: "step",
            step_index: 2,
            step_id: "s2",
        });
        expect(row.recent_steps?.[0].at).toEqual(expect.any(String));
    });

    it("keeps the correct flag of an answer", async () => {
        const row = await upsert({
            step_result: {step_id: "s1", correct: 0, total: 1},
            step_event: {kind: "answer", step_index: 1, step_id: "s1", correct: false},
        });
        expect(row.recent_steps?.at(-1)).toMatchObject({kind: "answer", correct: false});
    });

    it.each([
        {name: "none", sent: 0, kept: 0},
        {name: "one", sent: 1, kept: 1},
        {name: "exactly-cap", sent: 10, kept: 10},
        {name: "one-over-cap", sent: 11, kept: 10},
        {name: "far-over-cap", sent: 25, kept: 10},
    ])("keeps only the newest ten ($name)", async ({sent, kept}) => {
        let row = await upsert({current_step: 0});
        for (let index = 0; index < sent; index++) {
            row = await upsert({current_step: index, step_event: step(index)});
        }
        const indexes = (row.recent_steps ?? []).map((entry) => entry.step_index);
        expect(indexes).toEqual(
            Array.from({length: kept}, (_, i) => sent - kept + i),
        );
    });

    it("collapses consecutive identical step events", async () => {
        await upsert({step_event: step(3)});
        const row = await upsert({step_event: step(3)});
        expect(row.recent_steps?.map((entry) => entry.step_index)).toEqual([3]);
    });

    it("keeps both identical steps when an action sits between them", async () => {
        await upsert({step_event: step(3)});
        await upsert({step_event: {kind: "pause", step_index: 3, step_id: "s3"}});
        const row = await upsert({step_event: step(3)});
        expect(row.recent_steps?.map((entry) => entry.kind)).toEqual([
            "step",
            "pause",
            "step",
        ]);
    });

    it("keeps the history across a restart and logs the restart", async () => {
        await upsert({step_event: step(4)});
        const row = await upsert({
            mark_restarted: true,
            step_event: {kind: "restart", step_index: 4, step_id: "s4"},
        });
        expect(row.recent_steps?.map((entry) => entry.kind)).toEqual([
            "step",
            "restart",
        ]);
        expect(row.current_step).toBe(0);
    });

    it("leaves the list unchanged on a write without an event", async () => {
        await upsert({step_event: step(1)});
        const row = await upsert({time_spent_seconds_delta: 30});
        expect(row.recent_steps?.map((entry) => entry.step_index)).toEqual([1]);
    });

    it("reports an empty list for a fresh row and a pre-feature row", async () => {
        expect((await upsert({current_step: 0})).recent_steps).toEqual([]);
        const db = getDb();
        const [stored] = await db.lessonProgress.toArray();
        delete stored.recent_steps;
        await db.lessonProgress.put(stored);
        expect((await upsert({time_spent_seconds_delta: 1})).recent_steps).toEqual([]);
    });
});
