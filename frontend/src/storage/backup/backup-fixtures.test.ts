/**
 * Every released backup format restores in browser mode (#3786).
 *
 * Each file in ``tests/fixtures/backups/`` was written by the export of the
 * release it names (see ``SOURCE.md`` there); none was built by hand. Each
 * is restored into an empty IndexedDB, exported again, and every row it
 * carries has to come back out. The backend half is
 * ``backend/tests/test_backup_fixtures.py``.
 *
 * Three tables are stored under the composite key the app reads, not under
 * the file's id (#3362), and a badge joins the seeded catalogue row with its
 * key (#3694): a row there is found by what identifies it for a learner,
 * written out below rather than taken from the restore code, so a wrong key
 * in the restore cannot agree with itself here.
 */

import "fake-indexeddb/auto";

import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import type {BackupPayload} from "../../types/domain";
import {_resetDbForTests} from "../dexie/db";
import {createDexieBackup} from "./backup-export";
import {restoreDexieBackup} from "./backup-restore";
import {SECRET_TABLES} from "./backup-tables";

const FIXTURES = join(__dirname, "../../../../tests/fixtures/backups");
const FILES = readdirSync(FIXTURES).filter((name) => name.endsWith(".json")).sort();

type Row = Record<string, unknown>;
type Rows = Record<string, Row[]>;

/** What identifies a row of a re-keyed table for the learner. */
const IDENTITY: Record<string, (row: Row) => unknown[]> = {
    lesson_progress: (row) => [row.source, row.set_id, row.lesson_filename],
    element_errors: (row) => [
        row.set_id,
        row.lesson_id,
        row.exercise_id,
        row.element_key,
        row.direction,
        // Format 1.5.0 added runs; a row of an older file belongs to run 1
        // (the contract stated at BACKUP_VERSION in backup-tables.ts).
        row.run_id ?? 1,
    ],
    speech_recordings: (row) => [row.source, row.set_id, row.lesson_filename, row.exercise_id],
    // The browser seeds the badge catalogue; a backup badge with a known key
    // becomes that local row and keeps the local id, its children follow (#3694).
    badges: (row) => [row.key],
};

function identityOf(table: string, row: Row): string {
    const identity = IDENTITY[table];
    return identity ? JSON.stringify(identity(row)) : String(row.id);
}

function load(name: string): BackupPayload {
    return JSON.parse(readFileSync(join(FIXTURES, name), "utf8")) as BackupPayload;
}

/** Rows of ``source`` that ``exported`` lacks, per table, and how many were compared. */
function missingRows(source: Rows, exported: Rows): {missing: Record<string, string[]>; compared: number} {
    const missing: Record<string, string[]> = {};
    let compared = 0;
    for (const [table, rows] of Object.entries(source)) {
        if (SECRET_TABLES.has(table) || rows.length === 0) {
            continue;
        }
        const back = new Set((exported[table] ?? []).map((row) => identityOf(table, row)));
        const ids = rows.map((row) => identityOf(table, row));
        compared += ids.length;
        const lost = ids.filter((id) => !back.has(id)).sort();
        if (lost.length > 0) {
            missing[table] = lost;
        }
    }
    return {missing, compared};
}

beforeEach(async () => {
    await _resetDbForTests();
    // fake-indexeddb keeps its data across _resetDbForTests; a fresh factory
    // per test keeps one fixture's rows (a badge) out of the next one's.
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
});

afterEach(async () => {
    await _resetDbForTests();
});

describe("released backups restore in browser mode (#3786)", () => {
    it("covers the formats the issue names", () => {
        const versions = new Set(FILES.map((name) => load(name).version));
        expect(FILES.length).toBeGreaterThanOrEqual(7);
        for (const version of ["1.2.0", "1.5.0", "1.9.0"]) {
            expect(versions).toContain(version);
        }
    });

    it.each(FILES)("%s restores every row", async (name) => {
        const payload = load(name);
        const summary = await restoreDexieBackup(payload.user_id, payload);
        expect(summary.errors).toEqual([]);
        const exported = await createDexieBackup(payload.user_id, "fixture-test");
        const {missing, compared} = missingRows(payload.data as Rows, exported.data as Rows);
        expect(compared, `${name}: row ids compared`).toBeGreaterThanOrEqual(25);
        expect(missing).toEqual({});
    });
});

describe("the comparison itself (#3786)", () => {
    it("reports a row that does not come back", () => {
        const source: Rows = {tags: [{id: "kept"}, {id: "lost"}], lesson_progress: []};
        const exported: Rows = {tags: [{id: "kept"}]};
        expect(missingRows(source, exported)).toEqual({missing: {tags: ["lost"]}, compared: 2});
    });

    it("finds a re-keyed row by what identifies it, not by its id", () => {
        const row = {id: "uuid-1", source: "a/b", set_id: "s", lesson_filename: "l.json"};
        const rekeyed = {...row, id: "u#a--b#s#l.json"};
        const other = {...row, id: "u#a--b#s#m.json", lesson_filename: "m.json"};
        expect(missingRows({lesson_progress: [row]}, {lesson_progress: [rekeyed]}).missing).toEqual({});
        expect(
            Object.keys(missingRows({lesson_progress: [row]}, {lesson_progress: [other]}).missing),
        ).toEqual(["lesson_progress"]);
    });
});
