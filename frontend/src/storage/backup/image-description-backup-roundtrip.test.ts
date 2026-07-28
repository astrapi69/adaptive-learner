/**
 * #2095 — backup round-trip for an ILLUSTRATED ext:al-image-description set.
 *
 * The image lives as an embedded ``data:`` URI inside the lesson JSON's
 * ``ext_payload.image``. This test seeds a user-generated content set carrying
 * such a lesson, exports it through the real ``createDexieBackup``, WIPES the
 * DB, restores through the real ``restoreDexieBackup``, and asserts the lesson
 * body — image data URI + accepted answers — survived verbatim.
 *
 * Why this is the "both modes" proof (#2053): an image-description exercise is
 * lesson CONTENT, read through ``getStorage().getLesson()`` identically in API
 * and Dexie mode — there is no new per-mode storage METHOD to diverge. The one
 * storage-crossing path is the backup, and Dexie is the mode where a
 * user-generated set exists ONLY in the local cache, so if the embedded image
 * survives the Dexie backup round-trip it survives everywhere.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {createDexieBackup, restoreDexieBackup} from "./backup";
import {_resetDbForTests, getDb} from "../dexie/db";
import {dexieStorage} from "../dexie-storage";

const IMG_DATA_URI = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD";
const SET_PK = "own--repo/cats/1";

const LESSON_BODY = JSON.stringify({
    id: "01-cat",
    title: "A cat",
    requires_extensions: ["ext:al-image-description@1"],
    steps: [
        {
            id: "s1",
            type: "exercise",
            exercise: {
                id: "ex-imgdesc-01",
                type: "ext:al-image-description",
                prompt: "Describe what you see.",
                card_ids: [],
                distractors: [],
                ext_payload: {image: IMG_DATA_URI, accept: ["a cat", "cat"]},
            },
        },
    ],
});

async function freshDb() {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
    const db = getDb();
    await Promise.all(
        [db.contentSets, db.contentSetFiles].map((table) => table.clear()),
    );
}

beforeEach(freshDb);
afterEach(_resetDbForTests);

describe("#2095 illustrated image-description set survives backup round-trip", () => {
    it("export -> wipe -> import keeps the embedded image + accepted answers", async () => {
        const user = await dexieStorage.users.create({
            name: "Aster",
            language: "de",
        });
        const db = getDb();
        await db.contentSets.put({
            id: SET_PK,
            source: "own/repo",
            set_id: "cats",
            version: 1,
            branch: "main",
        } as unknown as Parameters<typeof db.contentSets.put>[0]);
        await db.contentSetFiles.put({
            id: `${SET_PK}::lessons/01-cat.json`,
            set_pk: SET_PK,
            filename: "lessons/01-cat.json",
            body: LESSON_BODY,
            encoding: "text",
        } as unknown as Parameters<typeof db.contentSetFiles.put>[0]);

        // Export the whole local cache (content sets are install-global).
        const payload = await createDexieBackup(user.id, "2.7.0");
        expect(payload.content_sets?.length).toBeGreaterThan(0);

        // Wipe everything.
        await freshDb();
        const restoredUser = await dexieStorage.users.create({
            name: "Aster",
            language: "de",
        });

        // Restore through the real path.
        const summary = await restoreDexieBackup(restoredUser.id, payload);
        expect(summary.errors).toEqual([]);

        // The lesson body — with the embedded data URI + accepts — is intact.
        const files = await getDb()
            .contentSetFiles.where("set_pk")
            .equals(SET_PK)
            .toArray();
        const lessonFile = files.find(
            (file) => file.filename === "lessons/01-cat.json",
        );
        expect(lessonFile).toBeDefined();
        const parsed = JSON.parse(lessonFile!.body);
        const payloadOut = parsed.steps[0].exercise.ext_payload;
        expect(payloadOut.image).toBe(IMG_DATA_URI);
        expect(payloadOut.accept).toEqual(["a cat", "cat"]);
    });
});
