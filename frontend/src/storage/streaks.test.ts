/**
 * Browser-side streak service tests (Phase 29C).
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {_resetDbForTests, getDb, nowIso} from "./db";
import {
    calendarHeatmap,
    computeCurrentStreakWithState,
    getStreakState,
    setWeekendMode,
    updateStreakState,
} from "./streaks";

beforeEach(async () => {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

async function seedUserAndProject(): Promise<{userId: string; projectId: string}> {
    const db = getDb();
    const userId = "user-1";
    const projectId = "project-1";
    await db.users.put({
        id: userId,
        name: "Tester",
        email: null,
        language: "en",
        created_at: nowIso(),
        updated_at: nowIso(),
    });
    await db.learningProjects.put({
        id: projectId,
        user_id: userId,
        topic: "Test",
        goal: "Test",
        timeframe: "1w",
        daily_minutes: 30,
        current_problem: null,
        active: true,
        created_at: nowIso(),
        updated_at: nowIso(),
    });
    return {userId, projectId};
}

describe("computeCurrentStreakWithState", () => {
    it("returns 0 when today has no activity (no freeze, no weekend mode)", () => {
        const r = computeCurrentStreakWithState(
            new Set(["2026-05-20"]),
            "2026-05-21",
            false,
            0,
        );
        expect(r.streak).toBe(0);
        expect(r.freezesConsumed).toBe(0);
    });

    it("counts consecutive days ending today", () => {
        const days = new Set(["2026-05-19", "2026-05-20", "2026-05-21"]);
        const r = computeCurrentStreakWithState(days, "2026-05-21", false, 0);
        expect(r.streak).toBe(3);
    });

    it("freezes pause the streak across a missed day", () => {
        // Today + 2 days ago (yesterday missed).
        const days = new Set(["2026-05-19", "2026-05-21"]);
        const r = computeCurrentStreakWithState(days, "2026-05-21", false, 1);
        expect(r.streak).toBe(2);
        expect(r.freezesConsumed).toBe(1);
    });

    it("weekend mode skips Sat/Sun", () => {
        // Friday 2026-05-22 active, Mon 2026-05-18..Thu 2026-05-21 also active.
        const days = new Set([
            "2026-05-18",
            "2026-05-19",
            "2026-05-20",
            "2026-05-21",
            "2026-05-22",
        ]);
        const r = computeCurrentStreakWithState(
            days,
            "2026-05-22",
            true,
            0,
        );
        expect(r.streak).toBe(5);
    });
});

describe("Dexie streak persistence", () => {
    it("creates singleton row on first update", async () => {
        const {userId} = await seedUserAndProject();
        await getDb().userStreaks.clear();
        const state = await getStreakState(userId);
        expect(state.current_streak_days).toBe(0);
        expect(state.longest_streak_days).toBe(0);
        expect(state.weekend_mode).toBe(false);
    });

    it("setWeekendMode persists the toggle", async () => {
        const {userId} = await seedUserAndProject();
        await getDb().userStreaks.clear();
        const state = await setWeekendMode(userId, true);
        expect(state.weekend_mode).toBe(true);
        const reread = await getStreakState(userId);
        expect(reread.weekend_mode).toBe(true);
    });

    it("updateStreakState bumps longest watermark", async () => {
        const {userId, projectId} = await seedUserAndProject();
        await getDb().userStreaks.clear();
        const today = nowIso().slice(0, 10);
        // 3 days of activity ending today.
        const sessions = [0, 1, 2].map((i) => {
            const d = new Date(`${today}T00:00:00Z`);
            d.setUTCDate(d.getUTCDate() - i);
            return {
                id: `s${i}`,
                project_id: projectId,
                method: "deductive" as const,
                started_at: d.toISOString(),
                ended_at: d.toISOString(),
                cycle_step: 3,
                status: "completed" as const,
            };
        });
        for (const s of sessions) {
            await getDb().learningSessions.put(s);
        }
        const state = await updateStreakState(userId);
        expect(state.current_streak_days).toBe(3);
        expect(state.longest_streak_days).toBe(3);
    });
});

describe("calendarHeatmap", () => {
    it("returns one entry per calendar day in the window", async () => {
        const {userId} = await seedUserAndProject();
        await getDb().learningSessions.clear();
        const out = await calendarHeatmap(userId, 14);
        expect(out).toHaveLength(14);
        for (const entry of out) {
            expect(entry.count).toBe(0);
        }
    });

    it("counts sessions per day inside the window", async () => {
        const {userId, projectId} = await seedUserAndProject();
        await getDb().learningSessions.clear();
        const today = nowIso();
        await getDb().learningSessions.put({
            id: "s1",
            project_id: projectId,
            method: "deductive",
            started_at: today,
            ended_at: today,
            cycle_step: 3,
            status: "completed",
        });
        const out = await calendarHeatmap(userId, 7);
        const todayIso = today.slice(0, 10);
        const todayEntry = out.find((e) => e.date === todayIso);
        expect(todayEntry?.count).toBe(1);
    });

    it("clamps the days window to [7, 730]", async () => {
        const {userId} = await seedUserAndProject();
        const low = await calendarHeatmap(userId, 1);
        expect(low).toHaveLength(7);
        const high = await calendarHeatmap(userId, 5000);
        expect(high).toHaveLength(730);
    });
});
