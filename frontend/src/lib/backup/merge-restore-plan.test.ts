/**
 * #3787 - the count shown before a restore uses the restore's own rule.
 *
 * The pre-restore preview counted every row that differs as "updated". The
 * merge updates a row only where the backup is newer, never touches an
 * append-only row, and never deletes, so the button promised updates the
 * restore then skipped. Each case here runs the real restore on the same
 * data and holds the plan against its summary.
 */

import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { diffBackups } from "./backup-diff";
import { planMergeRestore } from "./merge-restore-plan";
import { createDexieBackup, restoreDexieBackup } from "../../storage/backup";
import { BACKUP_TABLES } from "../../storage/backup/backup-tables";
import { _resetDbForTests, getDb } from "../../storage/dexie/db";
import { dexieStorage } from "../../storage/dexie-storage";
import { recordElementAttemptsDexie } from "../../storage/lessons/element-errors-dexie";
import type { BackupPayload } from "../../types/domain";

const TABLE = "element_errors";
const STAMP = BACKUP_TABLES[TABLE].timestampField;

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

/** A learner with one element row, and the device's state as a backup. */
async function seed(): Promise<{ userId: string; current: BackupPayload }> {
  const user = await dexieStorage.users.create({
    name: "Aster",
    language: "de",
  });
  await recordElementAttemptsDexie(user.id, [
    {
      set_id: "fr-a1",
      lesson_id: "01-intro.json",
      exercise_id: "ex-1",
      element_key: "merci",
      element_type: "vocabulary",
      user_answer: "x",
      correct_answer: "merci",
      correct: false,
    },
  ]);
  return {
    userId: user.id,
    current: await createDexieBackup(user.id, "9.9.9"),
  };
}

/** The same backup with its element rows changed and stamped ``when``. */
function withElementRows(
  payload: BackupPayload,
  when: string,
  extra: Record<string, unknown>[] = [],
): BackupPayload {
  const rows = (payload.data[TABLE] ?? []).map((row) => ({
    ...row,
    error_count: 99,
    [STAMP]: when,
  }));
  return {
    ...payload,
    data: { ...payload.data, [TABLE]: [...rows, ...extra] },
  } as BackupPayload;
}

describe("planMergeRestore counts what the merge then does (#3787)", () => {
  it("counts no update for a row the device holds in a newer state", async () => {
    const { userId, current } = await seed();
    const older = withElementRows(current, "2020-01-01T00:00:00.000Z");

    const plan = planMergeRestore(current, older, userId);
    // The plain diff, which the button used, calls the row changed.
    const diff = await diffBackups(current, older);
    const summary = await restoreDexieBackup(userId, older);

    expect(diff.totals.changed).toBeGreaterThan(0);
    expect(plan).toEqual({ added: summary.inserted, updated: summary.updated });
    expect(plan.updated).toBe(0);
  });

  it("counts the update for a row the backup holds in a newer state", async () => {
    const { userId, current } = await seed();
    const newer = withElementRows(current, "2099-01-01T00:00:00.000Z");

    const plan = planMergeRestore(current, newer, userId);
    const summary = await restoreDexieBackup(userId, newer);

    expect(plan).toEqual({ added: summary.inserted, updated: summary.updated });
    expect(plan.updated).toBe(1);
  });

  it("counts a row only the backup holds as added, and nothing for a row only the device holds", async () => {
    const { userId, current } = await seed();
    const [deviceRow] = current.data[TABLE] ?? [];
    const onlyInBackup = {
      ...deviceRow,
      id: `${String(deviceRow.id)}-other`,
      element_key: "bonjour",
    };
    // The backup lacks the device's row and holds another one.
    const backup = {
      ...current,
      data: { ...current.data, [TABLE]: [onlyInBackup] },
    } as BackupPayload;

    const plan = planMergeRestore(current, backup, userId);
    const summary = await restoreDexieBackup(userId, backup);

    expect(plan).toEqual({ added: summary.inserted, updated: summary.updated });
    expect(plan.added).toBe(1);
    // A merge never deletes: the device's own row is still there.
    expect(await getDb().elementErrors.count()).toBe(2);
  });

  it("counts no update for an append-only row that differs", async () => {
    const { userId, current } = await seed();
    const appendOnly = Object.keys(BACKUP_TABLES).find(
      (table) => BACKUP_TABLES[table].appendOnly,
    )!;
    const row = { id: "append-1", user_id: userId, note: "device" };
    const device = {
      ...current,
      data: { ...current.data, [appendOnly]: [row] },
    } as BackupPayload;
    const backup = {
      ...current,
      data: { ...current.data, [appendOnly]: [{ ...row, note: "backup" }] },
    } as BackupPayload;

    expect(planMergeRestore(device, backup, userId)).toEqual({
      added: 0,
      updated: 0,
    });
  });
});
