/**
 * Create-race regression pins for the #390 Class-C fixes (Phase 2).
 *
 * The pre-fix ``where(user_id).first() -> add()`` pattern lets two
 * concurrent first-time callers each insert a duplicate singleton row
 * (no unique constraint). These pins fire two callers via ``Promise.all``
 * and assert a single row survives; they are RED on the pre-fix code and
 * GREEN once the ensure helpers are transaction-wrapped. Two further pins
 * cover the schema side: the v27 unique indexes enforce uniqueness, and
 * the v26 dedup lets an existing DB with duplicates open clean (without
 * the dedup the v27 ``createIndex`` aborts the open with a ConstraintError
 * — verified by neutralising the dedup during development).
 */

import "fake-indexeddb/auto";
import Dexie from "dexie";
import {beforeEach, describe, expect, it} from "vitest";

import {AdaptiveLearnerDB, _resetDbForTests, getDb, nowIso} from "./db/db";
import {ensureSettings} from "./db/dexie-rows";
import {BUNDLED_BADGES, listBadgesWithProgress} from "./gamification/badges";

beforeEach(async () => {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

describe("#390 Class C — duplicate-safe ensure", () => {
    it("two concurrent ensureSettings produce exactly one row", async () => {
        const db = getDb();
        const userId = "u1";
        await db.users.put({
            id: userId,
            name: "T",
            email: null,
            language: "en",
            created_at: nowIso(),
            updated_at: nowIso(),
        });
        await Promise.all([
            ensureSettings(db, userId, "en"),
            ensureSettings(db, userId, "en"),
        ]);
        expect(
            await db.userSettings.where("user_id").equals(userId).count(),
        ).toBe(1);
    });

    it("two concurrent catalog seeds produce no duplicate badges", async () => {
        const db = getDb();
        await Promise.all([
            listBadgesWithProgress("u1"),
            listBadgesWithProgress("u2"),
        ]);
        expect(await db.badges.count()).toBe(BUNDLED_BADGES.length);
    });
});

describe("#390 Class C — v27 unique indexes enforce uniqueness", () => {
    it("rejects a second userXp row for the same user", async () => {
        const db = getDb();
        await db.userXp.put({
            id: "x1",
            user_id: "u1",
            total_xp: 0,
            level: 1,
            updated_at: nowIso(),
        });
        await expect(
            db.userXp.put({
                id: "x2",
                user_id: "u1",
                total_xp: 5,
                level: 1,
                updated_at: nowIso(),
            }),
        ).rejects.toThrow();
    });

    it("allows the same badge for two different users (compound key)", async () => {
        const db = getDb();
        await db.userBadges.put({
            id: "ub1",
            user_id: "u1",
            badge_id: "bg1",
            tier: "bronze",
            earned_at: nowIso(),
            updated_at: nowIso(),
        });
        // Same badge, different user -> allowed by &[user_id+badge_id].
        await expect(
            db.userBadges.put({
                id: "ub2",
                user_id: "u2",
                badge_id: "bg1",
                tier: "bronze",
                earned_at: nowIso(),
                updated_at: nowIso(),
            }),
        ).resolves.toBeDefined();
        // Same (user, badge) again -> rejected.
        await expect(
            db.userBadges.put({
                id: "ub3",
                user_id: "u1",
                badge_id: "bg1",
                tier: "silver",
                earned_at: nowIso(),
                updated_at: nowIso(),
            }),
        ).rejects.toThrow();
    });
});

describe("#390 Class C — v26 dedup lets a dup-laden DB open clean", () => {
    // Distinct DB name: reusing the default "adaptive-learner" collides
    // with the earlier tests' v27 open under the per-test IDBFactory swap
    // and confuses Dexie's process-level schema cache (same trap the
    // db-upgrade.test.ts suite documents).
    const MIGRATION_DB = "adaptive-learner-p2-migration";

    async function seedDuplicatesAtV25() {
        const old = new Dexie(MIGRATION_DB);
        old.version(25).stores({
            userSettings: "id, user_id",
            userXp: "id, user_id, updated_at",
            userStreaks: "id, user_id, updated_at",
            badges: "id, key, category, updated_at",
            userBadges: "id, user_id, badge_id, earned_at",
        });
        await old.open();
        await old.table("userSettings").bulkPut([
            {id: "a", user_id: "u1", language: "en", updated_at: "2026-01-01"},
            {id: "b", user_id: "u1", language: "de", updated_at: "2026-02-01"},
        ]);
        await old.table("userXp").bulkPut([
            {id: "x1", user_id: "u1", total_xp: 30, level: 1, updated_at: "2026-01-01"},
            {id: "x2", user_id: "u1", total_xp: 10, level: 1, updated_at: "2026-02-01"},
        ]);
        await old.table("badges").bulkPut([
            {id: "bg1", key: "first_session", category: "milestone", updated_at: "2026-01-01"},
            {id: "bg2", key: "first_session", category: "milestone", updated_at: "2026-02-01"},
        ]);
        await old.table("userBadges").bulkPut([
            {id: "ub1", user_id: "u1", badge_id: "bg1", tier: "bronze", earned_at: "2026-01-01"},
            {id: "ub2", user_id: "u1", badge_id: "bg2", tier: "bronze", earned_at: "2026-02-01"},
        ]);
        old.close();
    }

    it("dedups singletons + catalog and migrates without a ConstraintError", async () => {
        await seedDuplicatesAtV25();
        const db = new AdaptiveLearnerDB(MIGRATION_DB);
        await db.open();
        expect(db.verno).toBe(29);
        expect(
            await db.userSettings.where("user_id").equals("u1").count(),
        ).toBe(1);
        const xp = await db.userXp.where("user_id").equals("u1").toArray();
        expect(xp).toHaveLength(1);
        // Survivor keeps the higher total_xp.
        expect(xp[0].total_xp).toBe(30);
        expect(
            await db.badges.where("key").equals("first_session").count(),
        ).toBe(1);
        // userBadges remapped onto the surviving badge -> one pair.
        expect(
            await db.userBadges.where("user_id").equals("u1").count(),
        ).toBe(1);
        db.close();
    });
});
