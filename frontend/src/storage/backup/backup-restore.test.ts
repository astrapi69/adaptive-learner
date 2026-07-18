/**
 * backup-restore (#1806) — direct module pins.
 *
 * Complements the hub-level round-trips in backup.test.ts with the
 * restore edges those don't pin: the append-only duplicate skip, the
 * missing-id error path, a malformed (non-array) table block that
 * must not abort the rest, and the merge spread preserving
 * local-only fields on a mutable update.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {emptyTableSummary, restoreDexieBackup} from "./backup-restore";
import {BACKUP_FORMAT, BACKUP_VERSION} from "./backup-tables";
import {_resetDbForTests, getDb, nowIso} from "../dexie/db";
import type {BackupPayload} from "../../types/domain";

beforeEach(async () => {
    await _resetDbForTests();
    // fake-indexeddb keeps its data across _resetDbForTests (it only
    // closes the handle), so the seeded fixed-id rows must be cleared
    // explicitly or they collide on the next test's add().
    const db = getDb();
    await Promise.all(
        [db.users, db.learningProjects, db.learningSessions, db.tags, db.subjects, db.contentSets, db.contentSetFiles].map(
            (table) => table.clear(),
        ),
    );
});

afterEach(async () => {
    await _resetDbForTests();
});

/** Minimal valid payload around the given per-table data. */
function payloadWith(
    data: Record<string, unknown>,
): BackupPayload {
    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        app_version: "9.9.9",
        created_at: nowIso(),
        user_id: "u-1",
        storage_mode: "dexie",
        data,
        content_sets: [],
        stats: {total_records: 0, tables: {}},
    } as unknown as BackupPayload;
}

async function seedUserAndProject() {
    const db = getDb();
    const now = nowIso();
    await db.users.add({
        id: "u-1",
        name: "Aster",
        language: "de",
        created_at: now,
        updated_at: now,
    } as never);
    await db.learningProjects.add({
        id: "p-1",
        user_id: "u-1",
        topic: "Bayes",
        status: "active",
        created_at: now,
        updated_at: now,
    } as never);
    return db;
}

describe("restoreDexieBackup edges", () => {
    it("skips an existing append-only row and inserts the new one", async () => {
        const db = await seedUserAndProject();
        await db.learningSessions.add({
            id: "s-1",
            project_id: "p-1",
            method: "deductive",
            status: "active",
            started_at: "2026-01-01T00:00:00Z",
        } as never);
        const summary = await restoreDexieBackup(
            "u-1",
            payloadWith({
                learning_sessions: [
                    {
                        id: "s-1",
                        project_id: "p-1",
                        method: "CHANGED",
                        status: "completed",
                        started_at: "2026-02-01T00:00:00Z",
                    },
                    {
                        id: "s-2",
                        project_id: "p-1",
                        method: "inductive",
                        status: "active",
                        started_at: "2026-02-02T00:00:00Z",
                    },
                ],
            }),
        );
        expect(summary.tables.learning_sessions).toEqual(
            expect.objectContaining({inserted: 1, updated: 0, skipped: 1}),
        );
        const untouched = await db.learningSessions.get("s-1");
        expect(untouched?.method).toBe("deductive");
    });

    it("reports a record without an id and keeps going", async () => {
        await seedUserAndProject();
        const summary = await restoreDexieBackup(
            "u-1",
            payloadWith({
                tags: [
                    {user_id: "u-1", name: "no-id"},
                    {id: "t-1", user_id: "u-1", name: "ok", created_at: nowIso()},
                ],
            }),
        );
        expect(summary.tables.tags.inserted).toBe(1);
        expect(summary.tables.tags.skipped).toBe(1);
        expect(summary.errors).toEqual(
            expect.arrayContaining([expect.stringContaining("record missing 'id'")]),
        );
    });

    it("flags a non-array table block but still restores the others", async () => {
        await seedUserAndProject();
        const summary = await restoreDexieBackup(
            "u-1",
            payloadWith({
                tags: "corrupted-not-a-list",
                subjects: [{id: "subj-1", name: "Mathe", updated_at: nowIso()}],
            }),
        );
        expect(summary.errors).toEqual(
            expect.arrayContaining([
                expect.stringContaining("tags: expected list"),
            ]),
        );
        expect(summary.tables.subjects.inserted).toBe(1);
    });

    it("preserves local-only fields when a newer mutable row merges in", async () => {
        const db = await seedUserAndProject();
        await db.learningProjects.update("p-1", {
            local_only_marker: "keep-me",
        } as never);
        const summary = await restoreDexieBackup(
            "u-1",
            payloadWith({
                learning_projects: [
                    {
                        id: "p-1",
                        user_id: "u-1",
                        topic: "Bayes UPDATED",
                        status: "active",
                        created_at: "2026-01-01T00:00:00Z",
                        updated_at: "2099-01-01T00:00:00Z",
                    },
                ],
            }),
        );
        expect(summary.tables.learning_projects.updated).toBe(1);
        const merged = (await db.learningProjects.get("p-1")) as unknown as {
            topic: string;
            local_only_marker?: string;
        };
        expect(merged.topic).toBe("Bayes UPDATED");
        expect(merged.local_only_marker).toBe("keep-me");
    });
});

describe("emptyTableSummary", () => {
    it("starts all counters at zero with no errors", () => {
        expect(emptyTableSummary()).toEqual({
            inserted: 0,
            updated: 0,
            skipped: 0,
            errors: [],
        });
    });
});
