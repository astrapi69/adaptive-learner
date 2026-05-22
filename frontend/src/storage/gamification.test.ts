/**
 * Unit tests for the browser-side XP calculator (Phase 29A).
 *
 * Pins parity with the Python ``xp_service``: the curve, the
 * streak helper, and the session-XP arithmetic must produce the
 * exact same values so a Dexie-mode user and an API-mode user
 * earn the same XP for the same action.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {_resetDbForTests, getDb} from "./db";
import {
    awardXPFlat,
    awardXPForSession,
    calculateSessionXP,
    computeLevel,
    currentStreakDays,
    getXPState,
    levelThreshold,
} from "./gamification";

beforeEach(async () => {
    await _resetDbForTests();
    // Reset fake-indexeddb's underlying store so writes from
    // the previous test don't leak into this one (close+open
    // alone reuses the persisted blob).
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

// ---- Level curve ----------------------------------------------------------

describe("levelThreshold + computeLevel", () => {
    it("levelThreshold matches the Python spec (0/100/300/600/1000)", () => {
        expect(levelThreshold(1)).toBe(0);
        expect(levelThreshold(2)).toBe(100);
        expect(levelThreshold(3)).toBe(300);
        expect(levelThreshold(4)).toBe(600);
        expect(levelThreshold(5)).toBe(1000);
    });

    it("computeLevel walks the curve", () => {
        expect(computeLevel(0)).toBe(1);
        expect(computeLevel(99)).toBe(1);
        expect(computeLevel(100)).toBe(2);
        expect(computeLevel(299)).toBe(2);
        expect(computeLevel(300)).toBe(3);
        expect(computeLevel(1000)).toBe(5);
    });

    it("computeLevel clamps negative XP to level 1", () => {
        expect(computeLevel(-50)).toBe(1);
    });
});

// ---- Streak helper --------------------------------------------------------

describe("currentStreakDays", () => {
    it("returns 0 when today has no activity", () => {
        const days = new Set(["2026-05-20", "2026-05-19"]);
        expect(currentStreakDays(days, "2026-05-21")).toBe(0);
    });

    it("counts consecutive days ending today", () => {
        const days = new Set(["2026-05-21", "2026-05-20", "2026-05-19"]);
        expect(currentStreakDays(days, "2026-05-21")).toBe(3);
    });

    it("breaks the streak on the first gap", () => {
        const days = new Set([
            "2026-05-21",
            "2026-05-20",
            "2026-05-18",
        ]);
        expect(currentStreakDays(days, "2026-05-21")).toBe(2);
    });
});

// ---- calculateSessionXP --------------------------------------------------

describe("calculateSessionXP", () => {
    it("base 50 when no completed cycle and no streak", () => {
        const award = calculateSessionXP({
            cycle_step: 3,
            cycle_count: 1,
            streak_days: 0,
            is_first_method_session: false,
        });
        expect(award.xp_earned).toBe(50);
        expect(award.breakdown).toEqual({base: 50});
        expect(award.multiplier).toBe(1.0);
        expect(award.reason).toBe("session_complete");
    });

    it("seven-step + cycle bonus when cycle_step reaches 7", () => {
        const award = calculateSessionXP({
            cycle_step: 7,
            cycle_count: 1,
            streak_days: 0,
            is_first_method_session: false,
        });
        // 50 base + 10 cycle + 25 seven-step = 85
        expect(award.xp_earned).toBe(85);
    });

    it("first-method bonus +50", () => {
        const award = calculateSessionXP({
            cycle_step: 3,
            cycle_count: 1,
            streak_days: 0,
            is_first_method_session: true,
        });
        expect(award.xp_earned).toBe(100);
        expect(award.breakdown.first_method_bonus).toBe(50);
    });

    it("streak multiplier caps at 7 days (2.75x)", () => {
        const seven = calculateSessionXP({
            cycle_step: 3,
            cycle_count: 1,
            streak_days: 7,
            is_first_method_session: false,
        });
        const twenty = calculateSessionXP({
            cycle_step: 3,
            cycle_count: 1,
            streak_days: 20,
            is_first_method_session: false,
        });
        // 50 * 2.75 = 137.5 -> 138 (banker's: rounds to even — 138)
        expect(seven.xp_earned).toBe(138);
        expect(seven.multiplier).toBeCloseTo(2.75);
        expect(twenty.xp_earned).toBe(seven.xp_earned);
    });

    it("banker's rounding matches Python on the 62.5 edge", () => {
        // 50 * 1.25 = 62.5 -> 62 in Python (banker's). Match it.
        const award = calculateSessionXP({
            cycle_step: 3,
            cycle_count: 1,
            streak_days: 1,
            is_first_method_session: false,
        });
        expect(award.xp_earned).toBe(62);
    });
});

// ---- Dexie persistence ----------------------------------------------------

describe("Dexie awardXPForSession", () => {
    beforeEach(async () => {
        // Force a fully fresh DB instance per test in this group;
        // the file-level beforeEach is reinforced here because
        // fake-indexeddb has shown leakage across describe blocks
        // when IDBFactory swap and Dexie close happen out of
        // order.
        await _resetDbForTests();
        const {IDBFactory} = await import("fake-indexeddb");
        (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
            new IDBFactory();
    });

    async function seedUserAndProject(): Promise<{
        userId: string;
        projectId: string;
    }> {
        const db = getDb();
        const userId = "user-1";
        const projectId = "project-1";
        await db.users.put({
            id: userId,
            name: "Tester",
            email: null,
            language: "en",
            created_at: "2026-05-21T00:00:00Z",
            updated_at: "2026-05-21T00:00:00Z",
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
            created_at: "2026-05-21T00:00:00Z",
            updated_at: "2026-05-21T00:00:00Z",
        });
        return {userId, projectId};
    }

    it("creates the singleton row on first award", async () => {
        const {userId, projectId} = await seedUserAndProject();
        const db = getDb();
        // Insert the session this award is "for" so the streak
        // calc sees a same-day activity (streak_days = 1).
        await db.learningSessions.put({
            id: "session-1",
            project_id: projectId,
            method: "deductive",
            started_at: new Date().toISOString(),
            ended_at: null,
            cycle_step: 3,
            status: "completed",
            imported_conversation_id: null,
        });
        const award = await awardXPForSession({
            userId,
            sessionId: "session-1",
            method: "deductive",
            cycleStep: 3,
            cycleCount: 1,
        });
        // First-method bonus fires (no other completed sessions in
        // this method excluding session-1), streak=1, so
        // (50 + 50) * 1.25 = 125
        expect(award.xp_earned).toBe(125);
        expect(award.xp_total).toBe(125);
        expect(award.level).toBe(2);
        expect(award.level_up).toBe(true);
    });

    it("flat awards do not apply a multiplier", async () => {
        const {userId} = await seedUserAndProject();
        // Defensive: explicitly clear any leftover XP rows. The
        // describe-level beforeEach swaps the IDBFactory, but in
        // the same Vitest worker the prior test's Dexie writes
        // can occasionally outlive the close/reopen cycle.
        await getDb().userXp.clear();
        const award = await awardXPFlat(userId, 100, "assessment_complete");
        expect(award.xp_earned).toBe(100);
        expect(award.multiplier).toBe(1.0);
        expect(award.xp_total).toBe(100);
        expect(award.level).toBe(2);
    });

    it("getXPState reports xp_into_level + xp_to_next_level", async () => {
        const {userId} = await seedUserAndProject();
        await getDb().userXp.clear();
        await awardXPFlat(userId, 150, "test");
        const state = await getXPState(userId);
        expect(state.total_xp).toBe(150);
        expect(state.level).toBe(2);
        expect(state.next_level_threshold).toBe(300);
        expect(state.xp_into_level).toBe(50);
        expect(state.xp_to_next_level).toBe(150);
    });

    it("getXPState returns zero state for an unknown user", async () => {
        const state = await getXPState("nope");
        expect(state.total_xp).toBe(0);
        expect(state.level).toBe(1);
        expect(state.next_level_threshold).toBe(100);
    });
});
