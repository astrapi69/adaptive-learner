/**
 * Merging two lesson_progress rows on restore (#3787), browser half.
 *
 * The cases are shared with the API-mode half
 * (``backend/tests/test_progress_merge.py``) through
 * ``tests/fixtures/progress-merge-parity/cases.json``.
 */

import "fake-indexeddb/auto";

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import type {BackupPayload} from "../../types/domain";
import {restoreDexieBackup} from "../backup/backup-restore";
import {BACKUP_FORMAT, BACKUP_VERSION} from "../backup/backup-tables";
import {_resetDbForTests, getDb} from "../dexie/db";
import {mergeLessonProgress} from "./progress-merge";

interface Case {
    name: string;
    local: Record<string, unknown>;
    backup: Record<string, unknown>;
    expected: Record<string, unknown> & {changed: boolean};
}

const CASES = (
    JSON.parse(
        readFileSync(join(__dirname, "../../../../tests/fixtures/progress-merge-parity/cases.json"), "utf8"),
    ) as {cases: Case[]}
).cases;

describe("mergeLessonProgress (#3787)", () => {
    it.each(CASES.map((c) => [c.name, c] as const))("%s", (_name, c) => {
        const {row, changed} = mergeLessonProgress(c.local, c.backup);
        const {changed: expectedChanged, ...fields} = c.expected;
        expect(changed).toBe(expectedChanged);
        expect(Object.fromEntries(Object.keys(fields).map((f) => [f, row[f] ?? null]))).toEqual(fields);
    });

    it("reads the shared cases", () => {
        expect(CASES.length).toBeGreaterThanOrEqual(10);
    });
});

describe("restore keeps a completion against a newer opened row (#3787)", () => {
    beforeEach(async () => {
        await _resetDbForTests();
        const {IDBFactory} = await import("fake-indexeddb");
        (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
    });

    afterEach(async () => {
        await _resetDbForTests();
    });

    it("leaves the lesson completed with its balance", async () => {
        const key = "u-1#astrapi69--adaptive-learner-content#fr-a1#01-intro.json";
        const identity = {
            user_id: "u-1",
            source: "astrapi69/adaptive-learner-content",
            set_id: "fr-a1",
            lesson_filename: "01-intro.json",
        };
        await getDb().lessonProgress.put({
            ...identity,
            id: key,
            status: "in_progress",
            current_step: 1,
            step_results: {},
            score_correct: 0,
            score_total: 0,
            attempts: 0,
            updated_at: "2026-10-05T10:00:00+00:00",
        } as never);
        const payload = {
            format: BACKUP_FORMAT,
            version: BACKUP_VERSION,
            user_id: "u-1",
            storage_mode: "dexie",
            data: {
                lesson_progress: [
                    {
                        ...identity,
                        id: key,
                        status: "completed",
                        current_step: 0,
                        step_results: {},
                        score_correct: 8,
                        score_total: 10,
                        attempts: 1,
                        attempt_history: [{at: "2026-10-01T10:00:00+00:00", correct: 8, total: 10}],
                        best_score_correct: 8,
                        best_score_total: 10,
                        completed_at: "2026-10-01T10:00:00+00:00",
                        updated_at: "2026-10-01T10:00:00+00:00",
                    },
                ],
            },
        } as unknown as BackupPayload;
        const summary = await restoreDexieBackup("u-1", payload);
        expect(summary.tables.lesson_progress.updated).toBe(1);
        const row = (await getDb().lessonProgress.get(key)) as unknown as Record<string, unknown>;
        expect([row.status, row.attempts, row.best_score_correct]).toEqual(["completed", 1, 8]);
    });
});
