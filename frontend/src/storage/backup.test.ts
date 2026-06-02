/**
 * Tests for the Dexie backup module (Phase 15B).
 *
 * Mirrors backend/tests/test_backup_service.py: round-trip, API-
 * keys-excluded, malformed-payloads, merge-with-newer-wins.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
    BACKUP_FORMAT,
    BACKUP_VERSION,
    createDexieBackup,
    EXCLUDED_USER_SETTINGS_FIELDS,
    getDexieBackupStats,
    restoreDexieBackup,
    validateBackupPayload,
} from "./backup";
import {_resetDbForTests, getDb} from "./db";
import {dexieStorage} from "./dexie-storage";

beforeEach(async () => {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

afterEach(async () => {
    await _resetDbForTests();
});

async function seedUser(name = "Aster") {
    const user = await dexieStorage.users.create({name, language: "de"});
    const project = await dexieStorage.users.projects.create(user.id, {
        topic: "Bayes",
        goal: "Master it",
        timeframe: "2 weeks",
        daily_minutes: 30,
    });
    const curriculum = await dexieStorage.curricula.create(user.id, {
        title: "Intro",
        language: "de",
    });
    return {user, project, curriculum};
}

// ---- Export tests ------------------------------------------------------

describe("createDexieBackup", () => {
    it("returns the canonical envelope shape", async () => {
        const {user} = await seedUser();
        const payload = await createDexieBackup(user.id, "1.2.0-test");
        expect(payload.format).toBe(BACKUP_FORMAT);
        expect(payload.version).toBe(BACKUP_VERSION);
        expect(payload.app_version).toBe("1.2.0-test");
        expect(payload.user_id).toBe(user.id);
        expect(payload.storage_mode).toBe("dexie");
        expect(payload.created_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
        expect(payload.data).toBeDefined();
        expect(payload.stats.total_records).toBeGreaterThan(0);
    });

    it("includes every backup table key (full sync surface)", async () => {
        const {user} = await seedUser();
        const payload = await createDexieBackup(user.id, "test");
        for (const table of [
            "users",
            "user_settings",
            "learning_projects",
            "learning_profiles",
            "curriculums",
            "learning_topics",
            "lessons",
            "learning_sessions",
            "session_messages",
            "session_ratings",
            "session_notes",
            "progress_commits",
            "method_switches",
            "step_evaluations",
            "imported_conversations",
            "imported_messages",
            // v1.9.0 / Phase 22A — Subjects + Tags taxonomy.
            "subjects",
            "tags",
            "project_subjects",
            "project_tags",
            // BACKUP-DIR-EXPORT-01 — gamification / progress / SRS /
            // missions. Before this fix, a Dexie-mode backup silently
            // omitted all of these, losing the user's learning state.
            "user_xp",
            "badges",
            "user_badges",
            "anki_card_suggestions",
            "study_questions",
            "user_streaks",
            "lesson_progress",
            "element_errors",
            "user_missions",
            "api_key_backups",
        ]) {
            expect(payload.data).toHaveProperty(table);
            expect(Array.isArray(payload.data[table])).toBe(true);
        }
    });

    it("round-trips lesson progress + element errors (BACKUP-DIR-EXPORT-01)", async () => {
        const {user} = await seedUser();
        const db = getDb();
        // Plant the kind of learning state that the pre-fix Dexie
        // backup dropped on the floor.
        await db.lessonProgress.add({
            id: "lp-1",
            user_id: user.id,
            set_id: "es-a1",
            lesson_filename: "01-greetings.json",
            status: "completed",
            stars: 3,
            updated_at: "2026-06-01T10:00:00.000Z",
        } as never);
        await db.elementErrors.add({
            id: "ee-1",
            user_id: user.id,
            element_key: "hola",
            direction: "target_to_source",
            error_count: 2,
            consecutive_correct: 0,
            updated_at: "2026-06-01T10:00:00.000Z",
        } as never);

        const payload = await createDexieBackup(user.id, "test");
        expect(payload.data.lesson_progress).toHaveLength(1);
        expect(payload.data.element_errors).toHaveLength(1);

        // Wipe the local state, then restore from the backup.
        await db.lessonProgress.clear();
        await db.elementErrors.clear();
        expect(await db.lessonProgress.count()).toBe(0);

        const summary = await restoreDexieBackup(user.id, payload);
        expect(summary.tables.lesson_progress.inserted).toBe(1);
        expect(summary.tables.element_errors.inserted).toBe(1);
        expect(await db.lessonProgress.get("lp-1")).toBeTruthy();
        expect(await db.elementErrors.get("ee-1")).toBeTruthy();
    });

    it("excludes api_key_* fields from user_settings rows", async () => {
        const {user} = await seedUser();
        // Plant API keys so we know they would otherwise leak.
        const db = getDb();
        await db.userSettings
            .where("user_id")
            .equals(user.id)
            .modify({
                api_key_anthropic: "sk-secret-anthropic",
                api_key_openai: "sk-secret-openai",
            });
        const payload = await createDexieBackup(user.id, "test");
        const settings = payload.data.user_settings as Record<string, unknown>[];
        expect(settings.length).toBeGreaterThan(0);
        for (const row of settings) {
            for (const field of EXCLUDED_USER_SETTINGS_FIELDS) {
                expect(row).not.toHaveProperty(field);
            }
            expect(row.active_provider).toBe("anthropic");
        }
    });

    it("scopes to one user (other users do not leak)", async () => {
        const a = await seedUser("UserA");
        const b = await seedUser("UserB");
        const payload = await createDexieBackup(a.user.id, "test");
        const projects = payload.data.learning_projects as Record<string, unknown>[];
        const userIds = new Set(projects.map((row) => row.user_id));
        expect(userIds).toEqual(new Set([a.user.id]));
        expect(userIds.has(b.user.id)).toBe(false);
    });

    it("stats.tables match data row counts", async () => {
        const {user} = await seedUser();
        const payload = await createDexieBackup(user.id, "test");
        let total = 0;
        for (const [table, rows] of Object.entries(payload.data)) {
            expect(payload.stats.tables[table]).toBe(rows.length);
            total += rows.length;
        }
        expect(payload.stats.total_records).toBe(total);
    });
});

// ---- Stats tests --------------------------------------------------------

describe("getDexieBackupStats", () => {
    it("returns counts that match the export shape", async () => {
        const {user} = await seedUser();
        const stats = await getDexieBackupStats(user.id);
        const payload = await createDexieBackup(user.id, "test");
        expect(stats.tables).toEqual(payload.stats.tables);
        expect(stats.total_records).toBe(payload.stats.total_records);
        expect(stats.user_id).toBe(user.id);
    });
});

// ---- Validate tests -----------------------------------------------------

describe("validateBackupPayload", () => {
    it("accepts a well-formed payload", () => {
        expect(() =>
            validateBackupPayload({
                format: BACKUP_FORMAT,
                version: BACKUP_VERSION,
                created_at: "2026-05-20T00:00:00Z",
                user_id: "u",
                storage_mode: "dexie",
                data: {},
                stats: {total_records: 0, tables: {}},
            }),
        ).not.toThrow();
    });

    it("rejects a wrong format", () => {
        expect(() =>
            validateBackupPayload({
                format: "not-ours",
                version: "1.0",
                data: {},
            }),
        ).toThrow(/Unrecognized backup format/);
    });

    it("rejects a non-object payload", () => {
        expect(() => validateBackupPayload("nope")).toThrow();
        expect(() => validateBackupPayload(null)).toThrow();
    });

    it("rejects missing version", () => {
        expect(() =>
            validateBackupPayload({format: BACKUP_FORMAT, data: {}}),
        ).toThrow(/'version'/);
    });

    it("rejects missing data segment", () => {
        expect(() =>
            validateBackupPayload({format: BACKUP_FORMAT, version: "1.0"}),
        ).toThrow(/'data'/);
    });
});

// ---- Restore tests ------------------------------------------------------

describe("restoreDexieBackup", () => {
    it("merges a backup back into the same DB as a no-op (idempotent)", async () => {
        const {user} = await seedUser();
        const payload = await createDexieBackup(user.id, "test");
        const summary = await restoreDexieBackup(user.id, payload);
        // Everything already exists, so nothing inserted/updated;
        // matching rows are skipped via the timestamp tie-break.
        expect(summary.inserted).toBe(0);
        expect(summary.updated).toBe(0);
        expect(summary.skipped).toBeGreaterThan(0);
        expect(summary.errors).toEqual([]);
    });

    it("inserts every row when the DB is wiped between export and import", async () => {
        const {user} = await seedUser();
        const payload = await createDexieBackup(user.id, "test");
        const db = getDb();
        await db.delete();
        // Reopen a fresh DB.
        await _resetDbForTests();
        const summary = await restoreDexieBackup(user.id, payload);
        expect(summary.inserted).toBeGreaterThan(0);
        const fresh = await dexieStorage.users.get(user.id);
        expect(fresh.id).toBe(user.id);
    });

    it("never overwrites live api_key_* values, even if the file carries them", async () => {
        const {user} = await seedUser();
        // Set a real local key.
        await dexieStorage.settings.setApiKey(user.id, {
            provider: "anthropic",
            key: "sk-live-key",
        });
        const payload = await createDexieBackup(user.id, "test");
        // Hand-edit the payload to carry a malicious key.
        const future = new Date(Date.now() + 86400000).toISOString();
        const settings = payload.data.user_settings as Record<string, unknown>[];
        for (const row of settings) {
            row.api_key_anthropic = "sk-injected";
            row.api_key_openai = "sk-injected";
            row.api_key_gemini = "sk-injected";
            row.updated_at = future;
            row.active_provider = "openai";
        }
        await restoreDexieBackup(user.id, payload);
        const db = getDb();
        const live = await db.userSettings
            .where("user_id")
            .equals(user.id)
            .first();
        expect(live).toBeDefined();
        expect(live!.api_key_anthropic).toBe("sk-live-key");
        expect(live!.api_key_openai).toBeNull();
        // Non-secret field DID update because the backup was newer.
        expect(live!.active_provider).toBe("openai");
    });

    it("keeps the newer side on mutable rows (local-newer)", async () => {
        const {user} = await seedUser();
        const payload = await createDexieBackup(user.id, "test");
        // Local update AFTER the snapshot.
        await dexieStorage.users.update(user.id, {name: "Local-newer"});
        const summary = await restoreDexieBackup(user.id, payload);
        // Backup is older → no update.
        const live = await dexieStorage.users.get(user.id);
        expect(live.name).toBe("Local-newer");
        expect(summary.updated).toBe(0);
    });

    it("applies the backup when its timestamp is newer", async () => {
        const {user} = await seedUser();
        const payload = await createDexieBackup(user.id, "test");
        const future = new Date(Date.now() + 86400000).toISOString();
        const users = payload.data.users as Record<string, unknown>[];
        for (const row of users) {
            if (row.id === user.id) {
                row.name = "From-backup";
                row.updated_at = future;
            }
        }
        const summary = await restoreDexieBackup(user.id, payload);
        const live = await dexieStorage.users.get(user.id);
        expect(live.name).toBe("From-backup");
        expect(summary.updated).toBeGreaterThan(0);
    });

    it("rejects an unrecognized backup format", async () => {
        const {user} = await seedUser();
        await expect(
            restoreDexieBackup(user.id, {
                format: "not-ours",
                version: "1.0",
                data: {},
            } as never),
        ).rejects.toThrow(/Unrecognized backup format/);
    });

    it("skips records whose user_id does not match", async () => {
        const a = await seedUser("UserA");
        const payload = await createDexieBackup(a.user.id, "test");
        // Forge a row claiming to belong to a different user.
        (payload.data.learning_projects as Record<string, unknown>[]).push({
            id: "forged-id",
            user_id: "different-user",
            topic: "Forged",
            goal: "x",
            timeframe: "x",
            daily_minutes: 0,
            current_problem: null,
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        const summary = await restoreDexieBackup(a.user.id, payload);
        const db = getDb();
        const forged = await db.learningProjects.get("forged-id");
        expect(forged).toBeUndefined();
        expect(summary.inserted + summary.updated).not.toContain("forged-id");
    });
});

// ---- IStorageService wiring --------------------------------------------

describe("dexieStorage.backup namespace", () => {
    it("exposes export/import/stats", async () => {
        const {user} = await seedUser();
        const payload = await dexieStorage.backup.export(user.id);
        expect(payload.format).toBe(BACKUP_FORMAT);

        const stats = await dexieStorage.backup.stats(user.id);
        expect(stats.tables).toEqual(payload.stats.tables);

        const summary = await dexieStorage.backup.import(user.id, payload);
        expect(summary.user_id).toBe(user.id);
        expect(summary.errors).toEqual([]);
    });
});
