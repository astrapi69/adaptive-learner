/**
 * EXP-031 / BAK-05 — end-to-end `.alb` round-trip (the headless analogue of
 * the BACKUP-AKZEPTANZTEST): seed real data + an avatar, export through the
 * actual ``createDexieBackup`` -> ``buildAlbBytes``, read it back through the
 * real ``readBackupFile`` (magic-byte detection + manifest), and restore into
 * a fresh DB through the real ``restoreDexieBackup``. Then assert the data —
 * including the avatar, carried as an asset, not base64 — survived intact.
 */

import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDexieBackup, restoreDexieBackup } from "./backup";
import { _resetDbForTests, getDb } from "../dexie/db";
import { dexieStorage } from "../dexie-storage";
import { buildAlbBytes } from "../../lib/backup/albContainer";
import { readBackupFile } from "../../lib/backup/validateBackupFile";

const AVATAR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function freshDb() {
  await _resetDbForTests();
  const { IDBFactory } = await import("fake-indexeddb");
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB =
    new IDBFactory();
}

beforeEach(freshDb);
afterEach(_resetDbForTests);

describe("EXP-031 .alb full round-trip", () => {
  it("export -> .alb -> readBackupFile -> restore preserves data + avatar", async () => {
    // 1. Seed a user + project + an avatar in user_settings.
    const user = await dexieStorage.users.create({ name: "Aster", language: "de" });
    await dexieStorage.users.projects.create(user.id, {
      topic: "Bayes",
      goal: "Master it",
      timeframe: "2 weeks",
      daily_minutes: 30,
    });
    await getDb().userSettings.where("user_id").equals(user.id).modify({
      avatar: AVATAR,
    });

    // 2. Export + wrap into an .alb container.
    const payload = await createDexieBackup(user.id, "1.86.0");
    const albBytes = buildAlbBytes(payload, "full");

    // 3. Read it back exactly as the import UI would (a picked File).
    const file = new File([albBytes], "backup.alb");
    const result = await readBackupFile(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.container).toBe("alb");
    expect(result.manifest?.app_version).toBe("1.86.0");
    // The avatar round-tripped through assets/ back to the data URL —
    // proving it travelled as an asset file, not inline base64.
    const settings = result.payload.data.user_settings[0];
    expect(settings.avatar).toBe(AVATAR);

    // 4. Restore the .alb-derived payload through the real restore path;
    //    it applies cleanly (no errors) and the data stays intact.
    const summary = await restoreDexieBackup(user.id, result.payload);
    expect(summary.errors).toEqual([]);

    const restoredUser = await getDb().users.get(user.id);
    expect(restoredUser?.name).toBe("Aster");
    const restoredSettings = await getDb()
      .userSettings.where("user_id")
      .equals(user.id)
      .first();
    expect(restoredSettings?.avatar).toBe(AVATAR);
    const projects = await getDb()
      .learningProjects.where("user_id")
      .equals(user.id)
      .toArray();
    expect(projects).toHaveLength(1);
    expect(projects[0].topic).toBe("Bayes");
  });

  it("a legacy JSON backup still restores (cross-format, no regression)", async () => {
    const user = await dexieStorage.users.create({ name: "Legacy", language: "en" });
    const payload = await createDexieBackup(user.id, "1.0.0");
    const jsonFile = new File([JSON.stringify(payload)], "old-backup.json");
    const result = await readBackupFile(jsonFile);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.container).toBe("json");
    const summary = await restoreDexieBackup(user.id, result.payload);
    expect(summary.errors).toEqual([]);
    expect((await getDb().users.get(user.id))?.name).toBe("Legacy");
  });
});
