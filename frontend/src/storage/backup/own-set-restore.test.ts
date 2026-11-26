/**
 * #3932 - a restore brings back a lesson removed from an own set after the
 * backup was made. Dexie half; the API half is
 * ``backend/tests/test_content_backup_own_set.py`` (#2053: one test per mode).
 *
 * An own set always carries version 1.0.0, so its key cannot tell the set in
 * the backup from the set on the device. The restore therefore compares the
 * lessons: it adds what the device lacks and keeps the device's version of a
 * lesson both sides hold (owner decision on #3787, 2026-10-31).
 *
 * The fixtures go through the producers: ``saveUserSetDexie`` writes the set
 * and ``createDexieBackup`` the backup, as the app does.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {createDexieBackup} from "./backup";
import {restoreDexieContentSets} from "./backup-content-sets";
import {_resetDbForTests, getDb} from "../dexie/db";
import {listLessonsDexie, saveUserSetDexie} from "../content/content-loader-dexie";
import {USER_GENERATED_SOURCE, type ContentLesson, type SaveUserSetInput} from "../types";

async function freshDb() {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
}

beforeEach(freshDb);
afterEach(_resetDbForTests);

const USER = "u-1";
const SET_ID = "my-set";

function lesson(id: string, title: string): ContentLesson {
    return {
        id,
        title,
        description: null,
        estimated_minutes: 5,
        cards: [],
        steps: [],
    } as unknown as ContentLesson;
}

function ownSet(lessons: ContentLesson[]): SaveUserSetInput {
    return {
        set_id: SET_ID,
        title: "My set",
        language: "es",
        target_language: "es",
        source_language: "de",
        level: "A1",
        origin: "imported",
        lessons,
    } as SaveUserSetInput;
}

async function lessonTitles(): Promise<Record<string, string>> {
    const db = getDb();
    const files = await db.contentSetFiles.toArray();
    return Object.fromEntries(
        files
            .filter((file) => file.filename.startsWith("lessons/"))
            .map((file) => [file.filename, (JSON.parse(file.body) as {title: string}).title]),
    );
}

describe("restoring an own set that exists on the device (#3932)", () => {
    it("brings back a lesson removed after the backup, and keeps the device's version of a lesson on both sides", async () => {
        await saveUserSetDexie(ownSet([lesson("l-1", "One"), lesson("l-2", "Two")]), "2026-10-01T00:00:00Z");
        const backup = await createDexieBackup(USER, "9.9.9");
        // After the backup: l-2 is removed and l-1 edited.
        await saveUserSetDexie(ownSet([lesson("l-1", "One, edited")]), "2026-10-02T00:00:00Z");

        const result = await restoreDexieContentSets(getDb(), backup.content_sets);

        expect(result).toEqual({restored: 1, skipped: 0, errors: []});
        expect(await lessonTitles()).toEqual({
            "lessons/l-1.json": "One, edited",
            "lessons/l-2.json": "Two",
        });
        const listed = await listLessonsDexie(USER_GENERATED_SOURCE, SET_ID);
        expect([...listed.lessons].sort()).toEqual(["l-1.json", "l-2.json"]);
        const [row] = await getDb().contentSets.toArray();
        expect(row.lesson_count).toBe(2);
    });

    it("skips an own set whose lessons the device all holds", async () => {
        await saveUserSetDexie(ownSet([lesson("l-1", "One")]), "2026-10-01T00:00:00Z");
        const backup = await createDexieBackup(USER, "9.9.9");
        // The device gained a lesson since; nothing is missing from it.
        await saveUserSetDexie(ownSet([lesson("l-1", "One"), lesson("l-3", "Three")]), "2026-10-02T00:00:00Z");

        const result = await restoreDexieContentSets(getDb(), backup.content_sets);

        expect(result).toEqual({restored: 0, skipped: 1, errors: []});
        expect(Object.keys(await lessonTitles()).sort()).toEqual(["lessons/l-1.json", "lessons/l-3.json"]);
    });

    it("still skips a downloaded set of the same version: its key does identify its content", async () => {
        const db = getDb();
        const setPk = "owner--repo/fr-a1/3";
        await db.contentSets.put({
            id: setPk,
            source: "owner/repo",
            set_id: "fr-a1",
            version: "3",
            lesson_count: 1,
        } as never);
        await db.contentSetFiles.put({
            id: `${setPk}#lessons/01.json`,
            set_pk: setPk,
            filename: "lessons/01.json",
            body: "{}",
            encoding: "text",
        });

        const result = await restoreDexieContentSets(db, [
            {
                source: "owner/repo",
                set_id: "fr-a1",
                version: "3",
                meta: {id: setPk},
                files: [
                    {filename: "lessons/01.json", body: "{}", encoding: "text"},
                    {filename: "lessons/02.json", body: "{}", encoding: "text"},
                ],
            },
        ]);

        expect(result).toEqual({restored: 0, skipped: 1, errors: []});
        expect(await db.contentSetFiles.count()).toBe(1);
    });
});
