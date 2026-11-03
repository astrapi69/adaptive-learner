/**
 * Rows from an older backup read like current rows through the app's own
 * readers (#3786).
 *
 * Most columns came into the backup without a format bump, so an older file
 * lacks them, and IndexedDB keeps whatever a restore writes. The readers fill
 * the gaps with ``??`` defaults. This test is the guard for the next column:
 * every older file in ``tests/fixtures/backups/`` is restored and read back
 * through the readers the UI calls, and every field those readers return for
 * the current 1.9.0 export has to come back defined for the older one too.
 * A new column read without a default turns it red. API mode needs no such
 * guard: there a column without a default fails the insert, which
 * ``backup-fixtures.test.ts`` and its backend half already catch.
 */

import "fake-indexeddb/auto";

import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import type {BackupPayload} from "../../types/domain";
import {_resetDbForTests} from "../dexie/db";
import {dexieStorage} from "../dexie-storage";
import {restoreDexieBackup} from "./backup-restore";

const FIXTURES = join(__dirname, "../../../../tests/fixtures/backups");
const REFERENCE = "api-1.9.0-v2.17.1.json";
const OLDER = readdirSync(FIXTURES)
    .filter((name) => name.endsWith(".json") && !name.includes("-1.9.0-"))
    .sort();

type Row = Record<string, unknown>;
type Read = Record<string, Row[]>;

function load(name: string): BackupPayload {
    return JSON.parse(readFileSync(join(FIXTURES, name), "utf8")) as BackupPayload;
}

function first(payload: BackupPayload, table: string): Row {
    const rows = payload.data[table] ?? [];
    expect(rows.length, `${table} rows in the fixture`).toBeGreaterThan(0);
    return rows[0];
}

/** Restore ``payload`` and read it back through the readers the UI calls. */
async function readThroughApp(payload: BackupPayload): Promise<Read> {
    await restoreDexieBackup(payload.user_id, payload);
    const userId = payload.user_id;
    const projectId = String(first(payload, "learning_projects").id);
    const sessionId = String(first(payload, "learning_sessions").id);
    const conversationId = String(first(payload, "imported_conversations").id);
    const asRows = (value: unknown): Row[] => (Array.isArray(value) ? value : [value]) as Row[];
    return {
        "lessonProgress.list": asRows(await dexieStorage.lessonProgress.list(userId)),
        "elementErrors.list": asRows(await dexieStorage.elementErrors.list(userId)),
        "session.get": asRows(await dexieStorage.session.get(sessionId)),
        "tracking.commits": asRows(await dexieStorage.tracking.commits(projectId)),
        "imports.list": asRows(await dexieStorage.imports.list(userId)),
        "imports.get": asRows(await dexieStorage.imports.get(conversationId)),
        "settings.get": asRows(await dexieStorage.settings.get(userId)),
    };
}

/** Field names defined in every row of a reader's result. */
function definedFields(rows: Row[]): Set<string> {
    const keys = new Set(rows.flatMap((row) => Object.keys(row)));
    return new Set([...keys].filter((key) => rows.every((row) => isDefined(row[key]))));
}

function isDefined(value: unknown): boolean {
    return value !== undefined && !(typeof value === "number" && Number.isNaN(value));
}

/** Per reader: fields the reference defines that ``older`` leaves undefined or NaN. */
function gaps(reference: Read, older: Read): {gaps: Record<string, string[]>; compared: number} {
    const found: Record<string, string[]> = {};
    let compared = 0;
    for (const [reader, rows] of Object.entries(reference)) {
        const expected = definedFields(rows);
        compared += expected.size;
        const back = older[reader] ?? [];
        const lost = [...expected].filter((key) => back.some((row) => !isDefined(row[key]))).sort();
        if (back.length === 0) {
            found[reader] = ["(no rows)"];
        } else if (lost.length > 0) {
            found[reader] = lost;
        }
    }
    return {gaps: found, compared};
}

async function freshDatabase(): Promise<void> {
    await _resetDbForTests();
    // fake-indexeddb keeps its data across _resetDbForTests.
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
}

beforeEach(freshDatabase);

afterEach(async () => {
    await _resetDbForTests();
});

describe("older backups read like current ones through the app's readers (#3786)", () => {
    it.each(OLDER)("%s leaves no field undefined", async (name) => {
        const reference = await readThroughApp(load(REFERENCE));
        await freshDatabase();
        const older = await readThroughApp(load(name));
        const {gaps: found, compared} = gaps(reference, older);
        expect(compared, `${name}: fields compared`).toBeGreaterThanOrEqual(80);
        expect(found).toEqual({});
    });

    it("compares the older files, not none", () => {
        expect(OLDER.length).toBeGreaterThanOrEqual(5);
    });
});

describe("the comparison itself (#3786)", () => {
    it("reports a field the reference defines and an older row leaves undefined or NaN", () => {
        const reference: Read = {reader: [{a: 1, b: "x", c: 2}]};
        const older: Read = {reader: [{a: 1, b: undefined, c: Number.NaN}]};
        expect(gaps(reference, older)).toEqual({gaps: {reader: ["b", "c"]}, compared: 3});
    });

    it("reports a reader that returns no rows for the older file", () => {
        expect(gaps({reader: [{a: 1}]}, {reader: []}).gaps).toEqual({reader: ["(no rows)"]});
    });
});
