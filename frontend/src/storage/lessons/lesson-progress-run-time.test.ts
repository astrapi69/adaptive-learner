/**
 * Dexie twin of backend ``test_lesson_progress_run_time.py`` (#3747): the
 * time of the current run apart from the lifetime total, same rules in both
 * storage modes.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {upsertLessonProgressDexie} from "./lesson-progress-dexie";
import {_resetDbForTests, getDb} from "../dexie/db";
import type {LessonProgressUpsertBody} from "../types";

const USER = "user-1";
const IDENTITY = {
    source: "astrapi69/adaptive-learner-content",
    set_id: "language-fr-a1",
    lesson_filename: "01-greetings.json",
};

const upsert = (extra: Partial<LessonProgressUpsertBody> = {}) =>
    upsertLessonProgressDexie(USER, {...IDENTITY, ...extra});

beforeEach(async () => {
    const db = getDb();
    try {
        await db.lessonProgress.clear();
    } catch {
        /* fresh DB */
    }
    await _resetDbForTests();
});

describe("Dexie lessonProgress: run time (#3747)", () => {
    it("a fresh row has no run time", async () => {
        const row = await upsert();
        expect([row.run_time_seconds, row.time_spent_seconds]).toEqual([0, 0]);
    });

    it("a delta counts for the run and the lifetime", async () => {
        await upsert({time_spent_seconds_delta: 40});
        const row = await upsert({time_spent_seconds_delta: 20});
        expect([row.run_time_seconds, row.time_spent_seconds]).toEqual([60, 60]);
    });

    it.each([
        ["restart", {mark_restarted: true}],
        ["abandon", {mark_abandoned: true}],
    ] as const)("a %s starts the run at zero, the lifetime keeps growing", async (_name, flag) => {
        await upsert({time_spent_seconds_delta: 2100});
        const reset = await upsert(flag);
        expect([reset.run_time_seconds, reset.time_spent_seconds]).toEqual([0, 2100]);
        if ("mark_abandoned" in flag) await upsert({mark_restarted: true});
        const row = await upsert({time_spent_seconds_delta: 180});
        expect([row.run_time_seconds, row.time_spent_seconds]).toEqual([180, 2280]);
    });

    it("pause and resume keep the run time", async () => {
        await upsert({time_spent_seconds_delta: 90});
        await upsert({mark_paused: true});
        const row = await upsert({mark_resumed: true, time_spent_seconds_delta: 30});
        expect([row.run_time_seconds, row.time_spent_seconds]).toEqual([120, 120]);
    });

    it("a row from before the field reads the lifetime total, and runs on from it", async () => {
        const row = await upsert({time_spent_seconds_delta: 300});
        const db = getDb();
        const stored = await db.lessonProgress.get(row.id);
        delete (stored as {run_time_seconds?: number}).run_time_seconds;
        await db.lessonProgress.put(stored!);

        const legacy = await upsert();
        expect([legacy.run_time_seconds, legacy.time_spent_seconds]).toEqual([300, 300]);
        const next = await upsert({time_spent_seconds_delta: 10});
        expect([next.run_time_seconds, next.time_spent_seconds]).toEqual([310, 310]);
    });
});
