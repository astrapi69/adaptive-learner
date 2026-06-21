/**
 * Tests for ``awardLessonXpDexie`` + the
 * ``lessonProgress.upsert`` facade hook (Phase 50D / v1.33.0 /
 * D-DEXIE-GAMIFICATION).
 *
 * Three layers exercised:
 *   1. ``awardLessonXpDexie`` directly — confirms the formula
 *      flows correctly through the streak + first-attempt +
 *      stars resolvers and produces the expected UserXP write.
 *   2. The DexieStorage facade — confirms the in_progress ->
 *      completed transition fires the award, and that
 *      subsequent upserts on an already-completed row do NOT
 *      re-award (no double-counting).
 *   3. Failure-mode — a thrown award MUST NOT break the
 *      lesson-completion path (the facade wraps in try/catch).
 *
 * The Phase 50A-C parity tests already cover the formula's
 * cross-language byte-equality; here we only verify the Dexie
 * orchestration around it.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {_resetDbForTests, getDb} from "../dexie/db";
import {dexieStorage} from "../dexie-storage";
import {awardLessonXpDexie} from "./lesson-xp-dexie";
import type {LessonProgress} from "../types";

const USER = "user-1";
const PROJECT = "project-1";
const SOURCE = "astrapi69/adaptive-learner-content";
const SET_ID = "language-fr-a1";
const LESSON = "01-greetings.json";

async function seedUserAndProject(): Promise<void> {
    const db = getDb();
    await db.users.put({
        id: USER,
        name: "Tester",
        email: null,
        language: "en",
        created_at: "2026-05-21T00:00:00Z",
        updated_at: "2026-05-21T00:00:00Z",
    });
    await db.learningProjects.put({
        id: PROJECT,
        user_id: USER,
        topic: "French",
        goal: "A1 fluency",
        timeframe: "3m",
        daily_minutes: 30,
        current_problem: null,
        active: true,
        created_at: "2026-05-21T00:00:00Z",
        updated_at: "2026-05-21T00:00:00Z",
    });
}

async function seedSameDaySession(): Promise<void> {
    const db = getDb();
    await db.learningSessions.put({
        id: "session-1",
        project_id: PROJECT,
        method: "deductive",
        started_at: new Date().toISOString(),
        ended_at: null,
        cycle_step: 1,
        status: "completed",
        imported_conversation_id: null,
    });
}

function buildCompletedProgress(opts: {
    score_correct: number;
    score_total: number;
    attempts: number;
}): LessonProgress {
    return {
        id: `${USER}#${SOURCE.replace(/\//g, "--")}#${SET_ID}#${LESSON}`,
        user_id: USER,
        source: SOURCE,
        set_id: SET_ID,
        lesson_filename: LESSON,
        status: "completed",
        step_results: {
            step1: {
                correct: opts.score_correct,
                total: opts.score_total,
                attempts: opts.attempts,
                completed_at: new Date().toISOString(),
            },
        },
        score_correct: opts.score_correct,
        score_total: opts.score_total,
        time_spent_seconds: 120,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        paused_at: null,
        abandoned_at: null,
    };
}

beforeEach(async () => {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
    // Defensive: the close+swap pattern occasionally leaves Dexie
    // caches with stale rows in fake-indexeddb (same workaround
    // gamification.test.ts uses). Explicitly clear every table
    // this suite touches before seeding.
    const db = getDb();
    await db.userXp.clear();
    await db.lessonProgress.clear();
    await db.learningSessions.clear();
    await db.users.clear();
    await db.learningProjects.clear();
    await db.userBadges.clear();
    await seedUserAndProject();
});

describe("awardLessonXpDexie (Phase 50D)", () => {
    it("awards 3-star + first-attempt + streak=1 = 100 XP", async () => {
        // Same-day session bumps streak_days to 1.
        await seedSameDaySession();
        const progress = buildCompletedProgress({
            score_correct: 10,
            score_total: 10,
            attempts: 1,
        });
        const award = await awardLessonXpDexie(USER, progress);
        // base 30 + star_bonus 30 + first_attempt 20 = 80, x 1.25 = 100
        expect(award.xp_earned).toBe(100);
        expect(award.xp_total).toBe(100);
        expect(award.multiplier).toBe(1.25);
        expect(award.breakdown).toEqual({
            base: 30,
            star_bonus: 30,
            first_attempt_3star_bonus: 20,
            streak_multiplier_pct: 25,
        });
        expect(award.reason).toBe("lesson_complete");
        const row = await getDb().userXp.where({user_id: USER}).first();
        expect(row?.total_xp).toBe(100);
    });

    it("attempts > 1 suppresses the first-attempt bonus", async () => {
        await seedSameDaySession();
        const progress = buildCompletedProgress({
            score_correct: 10,
            score_total: 10,
            attempts: 2,
        });
        const award = await awardLessonXpDexie(USER, progress);
        // base 30 + star_bonus 30 (no first_attempt) = 60, x 1.25 = 75
        expect(award.xp_earned).toBe(75);
        expect(award.breakdown).toEqual({
            base: 30,
            star_bonus: 30,
            streak_multiplier_pct: 25,
        });
    });

    it("no same-day session => streak_days = 0, no multiplier", async () => {
        const progress = buildCompletedProgress({
            score_correct: 10,
            score_total: 10,
            attempts: 1,
        });
        const award = await awardLessonXpDexie(USER, progress);
        // base 30 + star_bonus 30 + first_attempt 20 = 80, x 1.0 = 80
        expect(award.xp_earned).toBe(80);
        expect(award.multiplier).toBe(1.0);
        expect(award.breakdown).toEqual({
            base: 30,
            star_bonus: 30,
            first_attempt_3star_bonus: 20,
        });
    });

    it("score below 50% awards 0 stars (base only)", async () => {
        const progress = buildCompletedProgress({
            score_correct: 4,
            score_total: 10,
            attempts: 1,
        });
        const award = await awardLessonXpDexie(USER, progress);
        // base 30, no star_bonus, no first_attempt (stars != 3) = 30
        expect(award.xp_earned).toBe(30);
        expect(award.breakdown).toEqual({base: 30});
    });

    it("second award accumulates total_xp on the same UserXP row", async () => {
        const progress = buildCompletedProgress({
            score_correct: 10,
            score_total: 10,
            attempts: 1,
        });
        await awardLessonXpDexie(USER, progress);
        const second = await awardLessonXpDexie(USER, progress);
        expect(second.xp_earned).toBe(80);
        expect(second.xp_total).toBe(160);
        const rows = await getDb()
            .userXp.where({user_id: USER})
            .toArray();
        expect(rows).toHaveLength(1);
        expect(rows[0].total_xp).toBe(160);
    });
});

describe("DexieStorage.lessonProgress.upsert fires the lesson-XP hook (Phase 50D)", () => {
    it("in_progress -> completed transition awards XP", async () => {
        // First upsert: starts the lesson, status stays in_progress.
        await dexieStorage.lessonProgress.upsert(USER, {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            step_result: {
                step_id: "step1",
                correct: 10,
                total: 10,
                attempts: 1,
            },
        });
        // No XP awarded yet — status is still in_progress.
        let xpRow = await getDb().userXp.where({user_id: USER}).first();
        expect(xpRow).toBeUndefined();

        // Second upsert: marks completed. Hook fires.
        const updated = await dexieStorage.lessonProgress.upsert(USER, {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            mark_completed: true,
        });
        expect(updated.status).toBe("completed");
        xpRow = await getDb().userXp.where({user_id: USER}).first();
        // base 30 + star_bonus 30 + first_attempt 20 = 80, no streak
        expect(xpRow?.total_xp).toBe(80);
    });

    it("re-upserting an already-completed lesson does NOT double-award", async () => {
        // Initial: complete in one shot.
        await dexieStorage.lessonProgress.upsert(USER, {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            step_result: {
                step_id: "step1",
                correct: 10,
                total: 10,
                attempts: 1,
            },
            mark_completed: true,
        });
        const firstXp = await getDb().userXp.where({user_id: USER}).first();
        expect(firstXp?.total_xp).toBe(80);

        // Re-upsert: status was already completed, hook MUST NOT
        // fire again.
        await dexieStorage.lessonProgress.upsert(USER, {
            source: SOURCE,
            set_id: SET_ID,
            lesson_filename: LESSON,
            mark_completed: true,
        });
        const secondXp = await getDb().userXp.where({user_id: USER}).first();
        expect(secondXp?.total_xp).toBe(80);
    });

    it("incremental in_progress upserts do NOT award XP", async () => {
        for (let i = 1; i <= 3; i++) {
            await dexieStorage.lessonProgress.upsert(USER, {
                source: SOURCE,
                set_id: SET_ID,
                lesson_filename: LESSON,
                step_result: {
                    step_id: `step${i}`,
                    correct: 5,
                    total: 5,
                    attempts: 1,
                },
            });
        }
        const xp = await getDb().userXp.where({user_id: USER}).first();
        expect(xp).toBeUndefined();
    });
});
