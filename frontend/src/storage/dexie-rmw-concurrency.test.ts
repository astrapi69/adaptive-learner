/**
 * Concurrency regression pins for the #390 Class-A read-modify-write
 * fixes (Phase 1). Each test fires two callers at the SAME (table, id)
 * via ``Promise.all`` and asserts both writes survive. Every test in
 * this file is RED on the pre-fix code (separate get/put transactions
 * lose one update) and GREEN once the read-modify-write is made atomic
 * with a Dexie ``table.modify()`` or ``db.transaction("rw", ...)``.
 *
 * fake-indexeddb reproduces IndexedDB's transaction serialization, so
 * the lost-update window is deterministic here, not flaky.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {_resetDbForTests, getDb, nowIso} from "./db/db";
import {persistXP, getXPState} from "./gamification/gamification";
import {setWeekendMode, updateStreakState, getStreakState} from "./gamification/streaks";
import {
    getLessonProgressDexie,
    upsertLessonProgressDexie,
} from "./dexie/lesson-progress-dexie";
import {dexieSession} from "./dexie/dexie-session";
import {evaluateBadgesForUser, listBadgesWithProgress} from "./gamification/badges";
import {
    listElementErrorsDexie,
    recordElementAttemptsDexie,
} from "./dexie/element-errors-dexie";

beforeEach(async () => {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

async function seedUser(userId = "u1"): Promise<string> {
    await getDb().users.put({
        id: userId,
        name: "Tester",
        email: null,
        language: "en",
        created_at: nowIso(),
        updated_at: nowIso(),
    });
    return userId;
}

async function seedProject(userId: string, projectId = "p1"): Promise<string> {
    await getDb().learningProjects.put({
        id: projectId,
        user_id: userId,
        topic: "x",
        goal: "y",
        timeframe: "1m",
        daily_minutes: 10,
        current_problem: null,
        active: true,
        kind: "standard",
        created_at: nowIso(),
        updated_at: nowIso(),
    });
    return projectId;
}

describe("#390 Class A — atomic read-modify-write", () => {
    it("persistXP: two concurrent +10 awards total 20 (no lost increment)", async () => {
        const userId = await seedUser();
        await getDb().userXp.put({
            id: "xp1",
            user_id: userId,
            total_xp: 0,
            level: 1,
            updated_at: nowIso(),
        });
        await Promise.all([persistXP(userId, 10), persistXP(userId, 10)]);
        expect((await getXPState(userId)).total_xp).toBe(20);
    });

    it("setWeekendMode racing updateStreakState keeps the toggle", async () => {
        const userId = await seedUser();
        await getDb().userStreaks.put({
            id: "s1",
            user_id: userId,
            freezes_available: 0,
            last_freeze_earned_on: null,
            last_freeze_used_on: null,
            weekend_mode: false,
            current_streak_days: 0,
            longest_streak_days: 0,
            updated_at: nowIso(),
        });
        await Promise.all([
            setWeekendMode(userId, true),
            updateStreakState(userId),
        ]);
        expect((await getStreakState(userId)).weekend_mode).toBe(true);
    });

    it("lessonProgress.upsert: two concurrent step_results both persist", async () => {
        const userId = await seedUser();
        const base = {source: "bundled:x", set_id: "s", lesson_filename: "l1.json"};
        await Promise.all([
            upsertLessonProgressDexie(userId, {
                ...base,
                step_result: {step_id: "a", correct: 1, total: 1},
            }),
            upsertLessonProgressDexie(userId, {
                ...base,
                step_result: {step_id: "b", correct: 1, total: 1},
            }),
        ]);
        const row = await getLessonProgressDexie(
            userId,
            base.source,
            base.set_id,
            base.lesson_filename,
        );
        expect(Object.keys(row!.step_results).sort()).toEqual(["a", "b"]);
        expect(row!.score_total).toBe(2);
    });

    it("session.end: a double-click commits + awards exactly once", async () => {
        const userId = await seedUser();
        const projectId = await seedProject(userId);
        const db = getDb();
        await db.learningSessions.put({
            id: "sess1",
            project_id: projectId,
            method: "deductive",
            started_at: nowIso(),
            ended_at: null,
            cycle_step: 7,
            status: "active",
            imported_conversation_id: null,
        });
        await db.sessionRatings.put({
            id: "r1",
            session_id: "sess1",
            understanding: 5,
            stress: 2,
            method_fit: 5,
            notes: "ok",
            created_at: nowIso(),
        });
        await Promise.all([
            dexieSession.end("sess1"),
            dexieSession.end("sess1"),
        ]);
        const commits = await db.progressCommits
            .where("project_id")
            .equals(projectId)
            .count();
        expect(commits).toBe(1);
        // XP awarded once, not doubled.
        const xpRows = await db.userXp.where({user_id: userId}).toArray();
        expect(xpRows).toHaveLength(1);
        const single = xpRows[0].total_xp;
        // A third (sequential) end is a no-op: the session is already
        // completed, so the award fan-out does not run again.
        await dexieSession.end("sess1");
        expect((await db.userXp.where({user_id: userId}).first())!.total_xp).toBe(
            single,
        );
    });

    it("evaluateBadgesForUser: two concurrent runs earn a badge once", async () => {
        const userId = await seedUser();
        const projectId = await seedProject(userId);
        await getDb().learningSessions.put({
            id: "sess1",
            project_id: projectId,
            method: "deductive",
            started_at: nowIso(),
            ended_at: nowIso(),
            cycle_step: 7,
            status: "completed",
            imported_conversation_id: null,
        });
        // Pre-seed the catalog so the race under test is purely the
        // userBadges duplicate-insert (the catalog-seed race is separate).
        await listBadgesWithProgress(userId);
        await Promise.all([
            evaluateBadgesForUser(userId),
            evaluateBadgesForUser(userId),
        ]);
        const count = await getDb()
            .userBadges.where({user_id: userId})
            .count();
        expect(count).toBe(1);
    });

    it("recordElementAttempts: concurrent corrects on one key accumulate", async () => {
        const userId = await seedUser();
        const attempt = {
            set_id: "s",
            lesson_id: "l",
            exercise_id: "e",
            element_key: "k",
            correct: true,
        };
        await Promise.all([
            recordElementAttemptsDexie(userId, [attempt]),
            recordElementAttemptsDexie(userId, [attempt]),
        ]);
        const rows = await listElementErrorsDexie(userId);
        expect(rows).toHaveLength(1);
        expect(rows[0].correct_streak).toBe(2);
    });
});
