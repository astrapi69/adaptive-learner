/**
 * #3787 - the reset mode of the restore, Dexie half: the device ends up
 * exactly at the backup's state. The API half is
 * ``backend/tests/test_backup_reset.py`` (#2053: one test per mode).
 *
 * What "exactly" covers was decided by the maintainer (2026-11-26): the
 * learner's rows in every backup table, own sets and downloaded sets alike;
 * the AI keys are never touched. A reset is all or nothing: a backup it
 * cannot apply in full leaves the device as it was.
 *
 * The fixtures go through the producers: ``recordElementAttemptsDexie`` and
 * ``saveUserSetDexie`` write the state, ``createDexieBackup`` the backup.
 */

import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDexieBackup, restoreDexieBackup } from "../backup";
import { EXCLUDED_USER_SETTINGS_FIELDS } from "../backup-tables";
import { _resetDbForTests, getDb } from "../../dexie/db";
import { dexieStorage } from "../../dexie-storage";
import { saveUserSetDexie } from "../../content/content-loader-dexie";
import { recordElementAttemptsDexie } from "../../lessons/element-errors-dexie";
import type { ContentLesson, SaveUserSetInput } from "../../types";
import type { BackupPayload } from "../../../types/domain";

async function freshDb() {
  await _resetDbForTests();
  const { IDBFactory } = await import("fake-indexeddb");
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB =
    new IDBFactory();
}

beforeEach(async () => {
  await freshDb();
  await Promise.all(getDb().tables.map((table) => table.clear()));
});
afterEach(_resetDbForTests);

async function recordWrong(userId: string, elementKey: string) {
  await recordElementAttemptsDexie(userId, [
    {
      set_id: "fr-a1",
      lesson_id: "01-intro.json",
      exercise_id: "ex-1",
      element_key: elementKey,
      element_type: "vocabulary",
      user_answer: "x",
      correct_answer: elementKey,
      correct: false,
    },
  ]);
}

async function elementKeys(userId: string): Promise<string[]> {
  const rows = await getDb()
    .elementErrors.where("user_id")
    .equals(userId)
    .toArray();
  return rows.map((row) => row.element_key).sort();
}

/** A learner with the rows "merci" and "salut", and the backup of that. */
async function seed(): Promise<{ userId: string; backup: BackupPayload }> {
  const user = await dexieStorage.users.create({
    name: "Aster",
    language: "de",
  });
  await recordWrong(user.id, "merci");
  await recordWrong(user.id, "salut");
  return { userId: user.id, backup: await createDexieBackup(user.id, "9.9.9") };
}

/** After the backup: "salut" deleted, "bonjour" added, "merci" changed. */
async function changeDevice(userId: string) {
  const db = getDb();
  const rows = await db.elementErrors.where("user_id").equals(userId).toArray();
  const salut = rows.find((row) => row.element_key === "salut")!;
  const merci = rows.find((row) => row.element_key === "merci")!;
  await db.elementErrors.delete(salut.id);
  await db.elementErrors.put({
    ...merci,
    error_count: 99,
    updated_at: "2099-01-01T00:00:00.000Z",
  });
  await recordWrong(userId, "bonjour");
}

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
    set_id: "my-set",
    title: "My set",
    language: "es",
    target_language: "es",
    source_language: "de",
    level: "A1",
    origin: "imported",
    lessons,
  } as SaveUserSetInput;
}

async function putDownloadedSet(setId: string) {
  const db = getDb();
  const setPk = `owner--repo/${setId}/3`;
  await db.contentSets.put({
    id: setPk,
    source: "owner/repo",
    set_id: setId,
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
}

async function setIds(): Promise<string[]> {
  return (await getDb().contentSets.toArray()).map((row) => row.set_id).sort();
}

async function ownLessonTitles(): Promise<Record<string, string>> {
  const files = await getDb().contentSetFiles.toArray();
  return Object.fromEntries(
    files
      .filter(
        (file) =>
          file.set_pk.includes("my-set") &&
          file.filename.startsWith("lessons/"),
      )
      .map((file) => [
        file.filename,
        (JSON.parse(file.body) as { title: string }).title,
      ]),
  );
}

describe("restoreDexieBackup in reset mode (#3787)", () => {
  it("removes what was added after the backup, brings back what was deleted, and undoes a newer change", async () => {
    const { userId, backup } = await seed();
    await changeDevice(userId);

    await restoreDexieBackup(userId, backup, { mode: "reset" });

    expect(await elementKeys(userId)).toEqual(["merci", "salut"]);
    const rows = await getDb()
      .elementErrors.where("user_id")
      .equals(userId)
      .toArray();
    expect(rows.find((row) => row.element_key === "merci")?.error_count).toBe(
      1,
    );
  });

  it("merges by default: the added row stays and the newer change is kept", async () => {
    const { userId, backup } = await seed();
    await changeDevice(userId);

    await restoreDexieBackup(userId, backup);

    expect(await elementKeys(userId)).toEqual(["bonjour", "merci", "salut"]);
    const rows = await getDb()
      .elementErrors.where("user_id")
      .equals(userId)
      .toArray();
    expect(rows.find((row) => row.element_key === "merci")?.error_count).toBe(
      99,
    );
  });

  it("leaves another learner's rows alone", async () => {
    const { userId, backup } = await seed();
    const other = await dexieStorage.users.create({
      name: "Other",
      language: "de",
    });
    await recordWrong(other.id, "gracias");

    await restoreDexieBackup(userId, backup, { mode: "reset" });

    expect(await elementKeys(other.id)).toEqual(["gracias"]);
    expect(await getDb().users.get(other.id)).toBeTruthy();
  });

  it("never touches the AI keys in the settings row", async () => {
    const { userId, backup } = await seed();
    const [keyField] = [...EXCLUDED_USER_SETTINGS_FIELDS];
    const db = getDb();
    const settings = await db.userSettings
      .where("user_id")
      .equals(userId)
      .first();
    await db.userSettings.put({
      ...(settings ?? { id: `settings-${userId}`, user_id: userId }),
      [keyField]: "secret-key",
    } as never);

    await restoreDexieBackup(userId, backup, { mode: "reset" });

    const after = await db.userSettings.where("user_id").equals(userId).first();
    expect((after as unknown as Record<string, unknown>)[keyField]).toBe(
      "secret-key",
    );
  });

  it("brings the sets exactly to the backup: own and downloaded alike", async () => {
    const { userId } = await seed();
    await saveUserSetDexie(
      ownSet([lesson("l-1", "One"), lesson("l-2", "Two")]),
      "2026-10-01T00:00:00Z",
    );
    await putDownloadedSet("in-backup");
    const backup = await createDexieBackup(userId, "9.9.9");
    // After the backup: the own set loses l-2, gains l-3, l-1 is edited;
    // one downloaded set is deleted and another one added.
    await saveUserSetDexie(
      ownSet([lesson("l-1", "One, edited"), lesson("l-3", "Three")]),
      "2026-10-02T00:00:00Z",
    );
    const db = getDb();
    await db.contentSets.delete("owner--repo/in-backup/3");
    await db.contentSetFiles
      .where("set_pk")
      .equals("owner--repo/in-backup/3")
      .delete();
    await putDownloadedSet("added-later");

    const summary = await restoreDexieBackup(userId, backup, { mode: "reset" });

    expect(await setIds()).toEqual(["in-backup", "my-set"]);
    expect(await ownLessonTitles()).toEqual({
      "lessons/l-1.json": "One",
      "lessons/l-2.json": "Two",
    });
    expect(summary.content_sets).toEqual({
      restored: 2,
      skipped: 0,
      errors: [],
    });
  });

  it("is all or nothing: a backup it cannot apply in full leaves the device as it was", async () => {
    const { userId, backup } = await seed();
    await changeDevice(userId);
    const broken = {
      ...backup,
      data: {
        ...backup.data,
        element_errors: [
          ...(backup.data.element_errors ?? []),
          { element_key: "no-id" },
        ],
      },
    } as BackupPayload;

    await expect(
      restoreDexieBackup(userId, broken, { mode: "reset" }),
    ).rejects.toThrow(/reset/i);

    expect(await elementKeys(userId)).toEqual(["bonjour", "merci"]);
  });
});
