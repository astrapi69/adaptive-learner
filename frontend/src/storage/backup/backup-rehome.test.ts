/**
 * Restoring another learner's backup onto the local learner (#3785).
 *
 * Device B writes its rows through the app's own writers and exports them;
 * device A (a fresh database, its own learner and progress) restores that
 * payload under its own id. Every assertion reads through the consumer the
 * app uses, for learner A, so the ids that embed the user id
 * (``lesson_progress``, ``element_errors``, ``speech_recordings``,
 * ``set_runs``) are checked against the producer's own key convention.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {backupOwnerId, rehomeBackupData} from "./backup-rehome";
import {restoreDexieBackup} from "./backup-restore";
import {_resetDbForTests, getDb} from "../dexie/db";
import {dexieStorage} from "../dexie-storage";
import {setRunKey} from "../lessons/set-runs-dexie";
import type {BackupPayload} from "../../types/domain";

const SOURCE = "astrapi69/adaptive-learner-content";
const SET_ID = "fr-a1-from-en";
const LESSON_B = "01-greetings.json";
const LESSON_A = "02-numbers.json";

/** A new, empty device: drop the database and forget the handle. */
async function freshDb(): Promise<void> {
    await getDb().delete();
    await _resetDbForTests();
}

/** Device B: a learner with progress in every user-keyed store, exported. */
async function backupOfDeviceB(): Promise<{userB: string; payload: BackupPayload}> {
    await freshDb();
    const userB = (await dexieStorage.users.create({name: "Learner B", language: "de"})).id;
    await dexieStorage.lessonProgress.upsert(userB, {
        source: SOURCE,
        set_id: SET_ID,
        lesson_filename: LESSON_B,
        current_step: 5,
        step_result: {step_index: 2, correct: 3, total: 4},
    } as never);
    await dexieStorage.elementErrors.recordBulk(userB, [
        {
            set_id: SET_ID,
            lesson_id: LESSON_B,
            exercise_id: "ex-1",
            element_key: "bonjour",
            element_type: "vocabulary",
            user_answer: "bonjur",
            correct_answer: "bonjour",
            correct: false,
        },
    ]);
    await dexieStorage.elementErrors.startRun(userB, SET_ID, {});
    await dexieStorage.speechRecordings.save(userB, {
        source: SOURCE,
        set_id: SET_ID,
        lesson_filename: LESSON_B,
        exercise_id: "ex-2",
        audio_base64: "UklGRg==",
        mime_type: "audio/webm",
        duration_ms: 900,
    } as never);
    const payload = await dexieStorage.backup.export(userB);
    return {userB, payload};
}

/** Device A: its own learner with its own lesson in progress. */
async function deviceA(): Promise<string> {
    await freshDb();
    const userA = (await dexieStorage.users.create({name: "Learner A", language: "de"})).id;
    await dexieStorage.lessonProgress.upsert(userA, {
        source: SOURCE,
        set_id: SET_ID,
        lesson_filename: LESSON_A,
        current_step: 2,
    } as never);
    return userA;
}

/** Every row of every user-keyed store, as ``store:user_id``. */
async function ownersOfAllRows(): Promise<string[]> {
    const db = getDb();
    const owners: string[] = [];
    for (const table of db.tables) {
        for (const row of (await table.toArray()) as {user_id?: unknown}[]) {
            if (typeof row.user_id === "string") owners.push(`${table.name}:${row.user_id}`);
        }
    }
    return owners;
}

let userA = "";
let userB = "";
let payload: BackupPayload;

beforeEach(async () => {
    ({userB, payload} = await backupOfDeviceB());
    userA = await deviceA();
});

afterEach(async () => {
    await _resetDbForTests();
});

describe("restoring another learner's backup (#3785)", () => {
    it("reproduces the defect class: the backup really is another learner's", () => {
        expect(backupOwnerId(payload)).toBe(userB);
        expect(userB).not.toBe(userA);
    });

    it("lesson_progress: B's lesson reads back for A, A's own lesson stays", async () => {
        const summary = await restoreDexieBackup(userA, payload);
        expect(summary.errors).toEqual([]);
        const restored = await dexieStorage.lessonProgress.get(userA, SOURCE, SET_ID, LESSON_B);
        expect(restored?.current_step).toBe(5);
        const own = await dexieStorage.lessonProgress.get(userA, SOURCE, SET_ID, LESSON_A);
        expect(own?.current_step).toBe(2);
    });

    it("element_errors: B's element error is in A's history of its run", async () => {
        await restoreDexieBackup(userA, payload);
        const rows = await dexieStorage.elementErrors.list(userA, {runId: 1});
        expect(rows.map((row) => row.element_key)).toContain("bonjour");
    });

    it("speech_recordings: B's recording is found for A by its exercise", async () => {
        await restoreDexieBackup(userA, payload);
        const recording = await dexieStorage.speechRecordings.get(
            userA,
            SOURCE,
            SET_ID,
            LESSON_B,
            "ex-2",
        );
        expect(recording?.audio_base64).toBe("UklGRg==");
    });

    it("set_runs: B's runs are A's runs, under the producer's key", async () => {
        await restoreDexieBackup(userA, payload);
        const runs = await dexieStorage.elementErrors.listRuns(userA, SET_ID);
        expect(runs.map((run) => run.run_id).sort()).toEqual([1, 2]);
        expect(runs.map((run) => run.id).sort()).toEqual([
            setRunKey(userA, SET_ID, 1),
            setRunKey(userA, SET_ID, 2),
        ]);
    });

    it("no second learner and no row left under B", async () => {
        await restoreDexieBackup(userA, payload);
        const users = await getDb().users.toArray();
        expect(users.map((row) => row.id)).toEqual([userA]);
        expect((await ownersOfAllRows()).filter((owner) => owner.endsWith(`:${userB}`))).toEqual([]);
    });

    it("per-user singletons merge into A's row through the unique index", async () => {
        await restoreDexieBackup(userA, payload);
        const settings = await getDb().userSettings.where("user_id").equals(userA).toArray();
        expect(settings).toHaveLength(1);
    });

    it("rows of a third learner stay skipped", async () => {
        const foreign = {
            ...payload,
            data: {
                ...payload.data,
                tags: [{id: "t-x", user_id: "someone-else", name: "x", created_at: "2026-01-01T00:00:00Z"}],
            },
        } as BackupPayload;
        await restoreDexieBackup(userA, foreign);
        expect(await getDb().tags.get("t-x")).toBeUndefined();
    });
});

describe("rehomeBackupData", () => {
    it.each([
        ["same learner on both sides", "u-a", "u-a"],
        ["unknown owner", null, "u-a"],
    ])("returns the data unchanged: %s", (_name, source, target) => {
        const data = {tags: [{id: "t1", user_id: "u-a"}]};
        expect(rehomeBackupData(data, source, target)).toBe(data);
    });

    it("moves the users row, user_id columns and set-run ids, nothing else", () => {
        const data = {
            users: [{id: "u-b", name: "B"}],
            tags: [{id: "t1", user_id: "u-b"}],
            set_runs: [{id: "u-b#s1#3", user_id: "u-b", set_id: "s1", run_id: 3}],
            subjects: [{id: "sub-1", name: "Math"}],
        };
        expect(rehomeBackupData(data, "u-b", "u-a")).toEqual({
            users: [{id: "u-a", name: "B"}],
            tags: [{id: "t1", user_id: "u-a"}],
            set_runs: [{id: "u-a#s1#3", user_id: "u-a", set_id: "s1", run_id: 3}],
            subjects: [{id: "sub-1", name: "Math"}],
        });
    });
});

describe("backupOwnerId", () => {
    it.each([
        ["top-level user_id", {user_id: "u-1", data: {users: [{id: "u-2"}]}}, "u-1"],
        ["first users row", {user_id: "", data: {users: [{id: "u-2"}]}}, "u-2"],
        ["nothing", {data: {}}, null],
    ])("resolves from %s", (_name, input, expected) => {
        expect(backupOwnerId(input)).toBe(expected);
    });
});
