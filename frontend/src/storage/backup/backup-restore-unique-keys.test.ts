/**
 * A restore into a device that already holds its own catalog or singleton
 * rows (#3694).
 *
 * Every device seeds the badge catalog with random ids and writes a default
 * streak row on the read path. A restore that matched by id only skipped the
 * backup's rows on the unique key (`badges.&key`, `userStreaks.&user_id`), so
 * the earned badges pointed at ids this catalog does not have and the streak
 * came back as the fresh default. Found by the generic browser round trip of
 * #3693.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {restoreDexieBackup} from "./backup-restore";
import {BACKUP_FORMAT, BACKUP_VERSION} from "./backup-tables";
import {_resetDbForTests, getDb} from "../dexie/db";
import type {BackupPayload} from "../../types/domain";

const USER = "u-1";
const OLD = "2026-01-01T00:00:00.000Z";
const NOW = "2026-10-08T12:00:00.000Z";

beforeEach(async () => {
    await _resetDbForTests();
    const db = getDb();
    await Promise.all([db.badges, db.userBadges, db.userStreaks, db.userXp].map((t) => t.clear()));
});

afterEach(async () => {
    await _resetDbForTests();
});

function payloadWith(data: Record<string, unknown>): BackupPayload {
    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        app_version: "9.9.9",
        created_at: NOW,
        user_id: USER,
        storage_mode: "dexie",
        data,
        content_sets: [],
        stats: {total_records: 0, tables: {}},
    } as unknown as BackupPayload;
}

function badge(id: string, key: string) {
    return {
        id,
        key,
        name_key: `gamification.badges.${key}.name`,
        description_key: `gamification.badges.${key}.description`,
        icon: "star",
        category: "getting_started",
        base_tier: "bronze",
        tier_thresholds: null,
        created_at: OLD,
        updated_at: OLD,
    };
}

function streak(id: string, overrides: Record<string, unknown>) {
    return {
        id,
        user_id: USER,
        freezes_available: 0,
        last_freeze_earned_on: null,
        last_freeze_used_on: null,
        weekend_mode: false,
        current_streak_days: 0,
        longest_streak_days: 0,
        updated_at: NOW,
        ...overrides,
    };
}

describe("restore into a device with its own catalog and singletons (#3694)", () => {
    it("points restored earned badges at this device's catalog row by key", async () => {
        const db = getDb();
        await db.badges.add(badge("local-b1", "first_session") as never);

        const summary = await restoreDexieBackup(
            USER,
            payloadWith({
                badges: [badge("remote-b1", "first_session")],
                user_badges: [
                    {id: "ub-1", user_id: USER, badge_id: "remote-b1", tier: "bronze", earned_at: OLD, updated_at: OLD},
                ],
            }),
        );

        expect(summary.errors).toEqual([]);
        expect((await db.userBadges.get("ub-1"))?.badge_id).toBe("local-b1");
        expect(await db.badges.where("key").equals("first_session").count()).toBe(1);
    });

    it("lets the backup's streak replace the default row the device wrote on read", async () => {
        const db = getDb();
        await db.userStreaks.add(streak("local-s", {updated_at: NOW}) as never);

        const summary = await restoreDexieBackup(
            USER,
            payloadWith({
                user_streaks: [
                    streak("remote-s", {
                        longest_streak_days: 12,
                        current_streak_days: 3,
                        freezes_available: 2,
                        weekend_mode: true,
                        updated_at: OLD,
                    }),
                ],
            }),
        );

        expect(summary.errors).toEqual([]);
        const rows = await db.userStreaks.where({user_id: USER}).toArray();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            id: "local-s",
            longest_streak_days: 12,
            freezes_available: 2,
            weekend_mode: true,
        });
    });

    it("lets the backup win over a row matched only by its unique key, even a newer one", async () => {
        // Same rule as the backend restore (#115): a row that holds the
        // unique slot under another id is a local placeholder, and the backup
        // is the source of truth for it. Both modes decide alike (#2053).
        const db = getDb();
        await db.userStreaks.add(streak("local-s", {longest_streak_days: 5, updated_at: NOW}) as never);

        await restoreDexieBackup(
            USER,
            payloadWith({user_streaks: [streak("remote-s", {longest_streak_days: 12, updated_at: OLD})]}),
        );

        expect((await db.userStreaks.get("local-s"))?.longest_streak_days).toBe(12);
    });

    it("keeps newer local data when the backup row has the same id", async () => {
        const db = getDb();
        await db.userStreaks.add(streak("same-s", {longest_streak_days: 5, updated_at: NOW}) as never);

        await restoreDexieBackup(
            USER,
            payloadWith({user_streaks: [streak("same-s", {longest_streak_days: 12, updated_at: OLD})]}),
        );

        expect((await db.userStreaks.get("same-s"))?.longest_streak_days).toBe(5);
    });

    it("lets the backup's XP replace a default XP row under another id", async () => {
        const db = getDb();
        await db.userXp.add({id: "local-x", user_id: USER, total_xp: 0, level: 1, updated_at: NOW} as never);

        const summary = await restoreDexieBackup(
            USER,
            payloadWith({user_xp: [{id: "remote-x", user_id: USER, total_xp: 450, level: 3, updated_at: OLD}]}),
        );

        expect(summary.errors).toEqual([]);
        const rows = await db.userXp.where({user_id: USER}).toArray();
        expect(rows.map((r) => [r.id, r.total_xp, r.level])).toEqual([["local-x", 450, 3]]);
    });
});
