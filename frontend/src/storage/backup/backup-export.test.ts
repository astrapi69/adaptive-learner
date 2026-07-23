/**
 * backup-export (#1806) — direct module pins.
 *
 * Complements the hub-level round-trips in backup.test.ts with the
 * export edges those don't pin: GLOBAL tables travel in full, the
 * ``via_*`` chains exclude another user's world, and an empty
 * content cache exports as an empty (not missing) block.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {createDexieBackup, getDexieBackupStats} from "./backup-export";
import {_resetDbForTests, getDb, nowIso} from "../dexie/db";

beforeEach(async () => {
    await _resetDbForTests();
    // fake-indexeddb keeps its data across _resetDbForTests (it only
    // closes the handle), so the seeded fixed-id rows must be cleared
    // explicitly or they collide on the next test's add().
    const db = getDb();
    await Promise.all(
        [db.users, db.learningProjects, db.learningSessions, db.badges, db.subjects, db.contentSets, db.contentSetFiles].map(
            (table) => table.clear(),
        ),
    );
});

afterEach(async () => {
    await _resetDbForTests();
});

/** Seed two users, each with a project + a session, plus global rows. */
async function seedTwoWorlds() {
    const db = getDb();
    const now = nowIso();
    await db.users.bulkAdd([
        {id: "u-1", name: "Aster", language: "de", created_at: now, updated_at: now},
        {id: "u-2", name: "Other", language: "en", created_at: now, updated_at: now},
    ] as never);
    await db.learningProjects.bulkAdd([
        {id: "p-1", user_id: "u-1", topic: "Bayes", status: "active", created_at: now, updated_at: now},
        {id: "p-2", user_id: "u-2", topic: "Chess", status: "active", created_at: now, updated_at: now},
    ] as never);
    await db.learningSessions.bulkAdd([
        {id: "s-1", project_id: "p-1", method: "deductive", status: "active", started_at: now},
        {id: "s-2", project_id: "p-2", method: "inductive", status: "active", started_at: now},
    ] as never);
    await db.badges.bulkAdd([
        {id: "b-1", key: "first_session", updated_at: now},
        {id: "b-2", key: "streak_3", updated_at: now},
    ] as never);
    await db.subjects.bulkAdd([
        {id: "subj-1", name: "Mathematik", updated_at: now},
    ] as never);
    return db;
}

describe("createDexieBackup scoping", () => {
    it("carries GLOBAL tables in full while user tables stay scoped", async () => {
        await seedTwoWorlds();
        const payload = await createDexieBackup("u-1", "9.9.9");
        expect(payload.data.badges).toHaveLength(2);
        expect(payload.data.subjects).toHaveLength(1);
        expect(payload.data.users).toHaveLength(1);
        expect(payload.data.users[0].id).toBe("u-1");
        expect(payload.data.learning_projects.map((row) => row.id)).toEqual([
            "p-1",
        ]);
    });

    it("excludes the other user's sessions via the project chain", async () => {
        await seedTwoWorlds();
        const payload = await createDexieBackup("u-1", "9.9.9");
        expect(payload.data.learning_sessions.map((row) => row.id)).toEqual([
            "s-1",
        ]);
    });

    it("exports an empty content cache as an empty block with zero stats", async () => {
        await seedTwoWorlds();
        const payload = await createDexieBackup("u-1", "9.9.9");
        expect(payload.content_sets).toEqual([]);
        expect(payload.stats.content_sets).toBe(0);
    });
});

describe("getDexieBackupStats scoping", () => {
    it("counts only the requesting user's rows plus the global tables", async () => {
        await seedTwoWorlds();
        const stats = await getDexieBackupStats("u-1");
        expect(stats.tables.users).toBe(1);
        expect(stats.tables.learning_projects).toBe(1);
        expect(stats.tables.learning_sessions).toBe(1);
        expect(stats.tables.badges).toBe(2);
        expect(stats.total_records).toBe(
            Object.values(stats.tables).reduce((sum, n) => sum + n, 0),
        );
    });
});
