/**
 * #3952 — the retirement reason of an element row rides the backup, Dexie
 * half. The API half is ``backend/tests/test_backup_retired_reason.py``; both
 * hold the same contract (#2053): the export carries ``retired_reason``, the
 * restore writes it back, and a retired row of a backup older than format
 * 1.10.0 (no reason) reads as retired by its author.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {createDexieBackup, restoreDexieBackup} from "./backup";
import {_resetDbForTests, getDb} from "../dexie/db";
import {dexieStorage} from "../dexie-storage";
import {
    listElementErrorsDexie,
    recordElementAttemptsDexie,
    retireUnservableDexie,
} from "../lessons/element-errors-dexie";
import type {BackupPayload} from "../../types/domain";

async function freshDb() {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
}

beforeEach(freshDb);
afterEach(_resetDbForTests);

async function seedRetiredRow(reason: "exercise_missing" | "lesson_missing") {
    const user = await dexieStorage.users.create({name: "Aster", language: "de"});
    await recordElementAttemptsDexie(user.id, [
        {
            set_id: "fr-a1",
            lesson_id: "01-intro.json",
            exercise_id: "gone-ex",
            element_key: "merci",
            element_type: "vocabulary",
            user_answer: "x",
            correct_answer: "merci",
            correct: false,
        },
    ]);
    const [row] = await listElementErrorsDexie(user.id);
    await retireUnservableDexie(user.id, [row.id], reason);
    return user.id;
}

const allRows = (userId: string) => listElementErrorsDexie(userId, {includeRetired: true});

describe("#3952 retired_reason survives the Dexie backup round-trip", () => {
    it.each(["exercise_missing", "lesson_missing"] as const)(
        "export -> wipe -> import keeps %s",
        async (reason) => {
            const userId = await seedRetiredRow(reason);
            const payload = await createDexieBackup(userId, "9.9.9");
            const exported = (payload.data.element_errors ?? []) as Record<string, unknown>[];
            expect(exported.map((row) => row.retired_reason)).toEqual([reason]);

            await getDb().elementErrors.clear();
            await restoreDexieBackup(userId, payload);

            const [restored] = await allRows(userId);
            expect(restored.retired_reason).toBe(reason);
            expect(restored.retired_at).toBeTruthy();
        },
    );

    it("a retired row of an older backup, without a reason, reads as author-retired", async () => {
        const userId = await seedRetiredRow("exercise_missing");
        const payload = await createDexieBackup(userId, "9.9.9");
        const older = {
            ...payload,
            version: "1.9.0",
            data: {
                ...payload.data,
                element_errors: (payload.data.element_errors ?? []).map((row) => {
                    const {retired_reason: _dropped, ...rest} = row as Record<string, unknown>;
                    return rest;
                }),
            },
        } as BackupPayload;

        await getDb().elementErrors.clear();
        await restoreDexieBackup(userId, older);

        const [restored] = await allRows(userId);
        expect(restored.retired_at).toBeTruthy();
        expect(restored.retired_reason).toBe("author");
    });
});
