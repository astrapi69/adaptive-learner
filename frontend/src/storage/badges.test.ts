/**
 * Browser-side badge evaluator tests (Phase 29B).
 *
 * Pins the catalog-vs-YAML lockstep + the seed-on-first-call
 * behaviour + the predicate-fires-once rule.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {
    BUNDLED_BADGES,
    evaluateBadgesForUser,
    listBadgesWithProgress,
} from "./badges";
import {_resetDbForTests, getDb, nowIso} from "./db";

beforeEach(async () => {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

async function seedUser(): Promise<string> {
    const db = getDb();
    const userId = "user-1";
    await db.users.put({
        id: userId,
        name: "Tester",
        email: null,
        language: "en",
        created_at: nowIso(),
        updated_at: nowIso(),
    });
    return userId;
}

describe("BUNDLED_BADGES", () => {
    it("ships exactly 24 entries (Phase 29B spec: 20-30)", () => {
        expect(BUNDLED_BADGES).toHaveLength(24);
    });

    it("has no duplicate keys", () => {
        const keys = BUNDLED_BADGES.map((b) => b.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("uses only the 5 spec categories", () => {
        const categories = new Set(BUNDLED_BADGES.map((b) => b.category));
        expect(categories).toEqual(
            new Set([
                "getting_started",
                "consistency",
                "method_explorer",
                "depth",
                "polyglot",
            ]),
        );
    });
});

describe("listBadgesWithProgress", () => {
    it("seeds the catalog on first call and reports all locked", async () => {
        const userId = await seedUser();
        const out = await listBadgesWithProgress(userId);
        expect(out).toHaveLength(BUNDLED_BADGES.length);
        for (const entry of out) {
            expect(entry.earned).toBe(false);
            expect(entry.earned_at).toBeNull();
        }
    });

    it("orders by category then by key", async () => {
        const userId = await seedUser();
        const out = await listBadgesWithProgress(userId);
        for (let i = 1; i < out.length; i++) {
            if (out[i - 1].category === out[i].category) {
                expect(
                    out[i].key.localeCompare(out[i - 1].key),
                ).toBeGreaterThanOrEqual(0);
            } else {
                expect(
                    out[i].category.localeCompare(out[i - 1].category),
                ).toBeGreaterThanOrEqual(0);
            }
        }
    });
});

describe("evaluateBadgesForUser", () => {
    it("awards first_session after a completed session lands", async () => {
        const userId = await seedUser();
        const db = getDb();
        const projectId = "p1";
        await db.learningProjects.put({
            id: projectId,
            user_id: userId,
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 30,
            current_problem: null,
            active: true,
            created_at: nowIso(),
            updated_at: nowIso(),
        });
        await db.learningSessions.put({
            id: "s1",
            project_id: projectId,
            method: "deductive",
            started_at: nowIso(),
            ended_at: nowIso(),
            cycle_step: 3,
            status: "completed",
        });
        const newly = await evaluateBadgesForUser(userId);
        expect(newly).toContain("first_session");
    });

    it("does not re-award a badge that was already earned", async () => {
        const userId = await seedUser();
        const db = getDb();
        // Defensive: drop any seed-leaked rows from a prior test
        // (fake-indexeddb close/reopen doesn't always wipe).
        await db.userBadges.clear();
        await db.badges.clear();
        await db.learningSessions.clear();
        await db.learningProjects.clear();
        await db.users.put({
            id: userId,
            name: "Tester",
            email: null,
            language: "en",
            created_at: nowIso(),
            updated_at: nowIso(),
        });
        const projectId = "p1";
        await db.learningProjects.put({
            id: projectId,
            user_id: userId,
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 30,
            current_problem: null,
            active: true,
            created_at: nowIso(),
            updated_at: nowIso(),
        });
        await db.learningSessions.put({
            id: "s1",
            project_id: projectId,
            method: "deductive",
            started_at: nowIso(),
            ended_at: nowIso(),
            cycle_step: 3,
            status: "completed",
        });
        const first = await evaluateBadgesForUser(userId);
        const second = await evaluateBadgesForUser(userId);
        expect(first).toContain("first_session");
        expect(second).not.toContain("first_session");
    });
});
