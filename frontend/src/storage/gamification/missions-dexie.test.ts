/**
 * Dexie-mode daily missions tests (EXP-010 / Phase 56C).
 *
 * Seeds existing data (lessonProgress / elementErrors) and checks
 * assignment, idempotency, live progress, and completion flips.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {RANDOM_PIN_GLOBAL} from "../../lib/random/pinned-random";
import {_resetDbForTests, getDb, newId} from "../dexie/db";
import {
    getDailyMissionsDexie,
    regenerateDailyMissionsDexie,
} from "./missions-dexie";

const USER = "user-1";
const TODAY = "2026-05-29"; // a Friday (weekday)

beforeEach(async () => {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
    // Dexie captures the original ``indexedDB`` reference at module
    // load, so the factory swap above does not fully reset storage
    // between tests (same pattern as streaks.test). Clear the tables
    // these tests touch so each starts clean.
    const db = getDb();
    await db.userMissions.clear();
    await db.lessonProgress.clear();
    await db.elementErrors.clear();
    await db.userStreaks.clear();
    await db.userXp.clear();
});

async function seedCompletedLesson(
    setId: string,
    correct: number,
    total: number,
    completedAt: string,
): Promise<void> {
    await getDb().lessonProgress.put({
        id: newId(),
        user_id: USER,
        source: "bundled:test",
        set_id: setId,
        lesson_filename: `${setId}-${newId()}.json`,
        status: "completed",
        step_results: {},
        score_correct: correct,
        score_total: total,
        time_spent_seconds: 600,
        started_at: `${completedAt}T09:00:00.000Z`,
        updated_at: `${completedAt}T09:10:00.000Z`,
        completed_at: `${completedAt}T09:10:00.000Z`,
        paused_at: null,
        abandoned_at: null,
    });
}

describe("getDailyMissionsDexie", () => {
    it("assigns 3 missions for a new user (learning/exploration only)", async () => {
        const {missions} = await getDailyMissionsDexie(USER, {
            todayIso: TODAY,
        });
        expect(missions).toHaveLength(3);
        for (const m of missions) {
            expect(["learning", "exploration"]).toContain(
                m.template.category,
            );
        }
    });

    it("is idempotent across calls on the same day", async () => {
        const first = await getDailyMissionsDexie(USER, {todayIso: TODAY});
        const second = await getDailyMissionsDexie(USER, {todayIso: TODAY});
        expect(first.missions.map((m) => m.id)).toEqual(
            second.missions.map((m) => m.id),
        );
    });

    it("reflects live progress from existing lessons", async () => {
        // Two lessons completed today -> any learning/exploration
        // "today" check (complete-N, min-stars, minutes) advances.
        await seedCompletedLesson("fr-a1", 10, 10, TODAY);
        await seedCompletedLesson("fr-a1", 9, 10, TODAY);
        const {missions} = await getDailyMissionsDexie(USER, {
            todayIso: TODAY,
        });
        // At least one assigned mission must show progress, since
        // the learner completed lessons today.
        expect(missions.some((m) => m.progress > 0)).toBe(true);
    });

    it("flips completed when the target is met and reports it once", async () => {
        await seedCompletedLesson("fr-a1", 10, 10, TODAY);
        // First call: complete-1-lesson (target 1) should complete.
        const first = await getDailyMissionsDexie(USER, {
            todayIso: TODAY,
            difficultyMix: "easy",
        });
        const completed1 = first.missions.filter((m) => m.completed);
        // Only assert the newly-completed bookkeeping is consistent.
        expect(first.newlyCompleted.map((m) => m.id).sort()).toEqual(
            completed1.map((m) => m.id).sort(),
        );
        // Second call: already-completed missions are NOT reported
        // as newly completed again.
        const second = await getDailyMissionsDexie(USER, {
            todayIso: TODAY,
            difficultyMix: "easy",
        });
        expect(second.newlyCompleted).toHaveLength(0);
    });

    it("awards mission XP once on completion (idempotent)", async () => {
        await seedCompletedLesson("fr-a1", 10, 10, TODAY);
        const first = await getDailyMissionsDexie(USER, {
            todayIso: TODAY,
            difficultyMix: "easy",
        });
        const completed = first.missions.filter((m) => m.completed);
        expect(completed.length).toBeGreaterThan(0);
        const expectedXp = completed.reduce(
            (sum, m) => sum + m.template.xp_reward,
            0,
        );
        const xpAfterFirst =
            (await getDb().userXp.where({user_id: USER}).first())?.total_xp ?? 0;
        expect(xpAfterFirst).toBe(expectedXp);
        // Second refresh must NOT double-award.
        await getDailyMissionsDexie(USER, {
            todayIso: TODAY,
            difficultyMix: "easy",
        });
        const xpAfterSecond =
            (await getDb().userXp.where({user_id: USER}).first())?.total_xp ?? 0;
        expect(xpAfterSecond).toBe(expectedXp);
    });

    it("regenerate reshuffles today's missions", async () => {
        await getDailyMissionsDexie(USER, {todayIso: TODAY});
        const {missions} = await regenerateDailyMissionsDexie(USER, {
            todayIso: TODAY,
        });
        expect(missions).toHaveLength(3);
        // The persisted set for today now matches the regenerated one.
        const stored = await getDb()
            .userMissions.where("[user_id+assigned_date]")
            .equals([USER, TODAY])
            .toArray();
        expect(stored).toHaveLength(3);
    });
});

describe("daily missions under the visual random pin (#3824)", () => {
    // Two learners whose ids pick different missions without a pin: the
    // visual runs seed a fresh random user id each time, so this difference
    // is what re-rolled the missions (and a completed mission's XP) per run.
    const LEARNER_A = "0c2f6f1e-5b1d-4c8a-9f3e-2a7d1c9b4e01";
    const LEARNER_B = "3f9a2c10-7d4e-4b6a-8e21-5c0d9b7f1a33";

    async function templateIds(userId: string): Promise<string[]> {
        const {missions} = await getDailyMissionsDexie(userId, {todayIso: TODAY});
        return missions.map((m) => m.template.id).sort();
    }

    it("without a pin, two learners get different missions", async () => {
        expect(await templateIds(LEARNER_A)).not.toEqual(await templateIds(LEARNER_B));
    });

    it("under the pin, two learners get the same missions on the same day", async () => {
        (globalThis as Record<string, unknown>)[RANDOM_PIN_GLOBAL] = {streamSeed: 0x1567, mountSalt: 13056};
        try {
            expect(await templateIds(LEARNER_A)).toEqual(await templateIds(LEARNER_B));
        } finally {
            delete (globalThis as Record<string, unknown>)[RANDOM_PIN_GLOBAL];
        }
    });
});
