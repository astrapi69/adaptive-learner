/**
 * Every Dexie store is either backed up or excluded with a reason (#3419).
 *
 * ``BACKUP_TABLES`` is the root registry: ``SYNC_TABLES`` derives from it
 * (#2827), so a store missing here misses backup AND sync. Nothing used to
 * compare it with the stores the Dexie schema declares, and #2824 shipped
 * that way: ``speechRecordings`` was added to the schema, never registered,
 * and every browser-mode export silently dropped every recording. This test
 * enumerates the schema itself, so the next new store has to decide.
 */

import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { _resetDbForTests, getDb } from "../dexie/db";
import { BACKUP_TABLES } from "./backup-tables";

/**
 * Stores that are deliberately not rows in ``BACKUP_TABLES``, each with the
 * reason. An entry whose store left the schema, or that ``BACKUP_TABLES``
 * now covers, fails the test: the list only shrinks on purpose.
 */
const EXCLUDED_FROM_BACKUP_TABLES: Record<string, string> = {
  contentSets:
    "content cache; carried by the backup's content_sets segment " +
    "(backup-export.ts, restored by backup-content-sets.ts), not as table rows",
  contentSetFiles: "content cache files; same content_sets segment as contentSets",
  userData:
    "Dexie mirror of managed localStorage keys; the backup carries them in its " +
    "local_storage snapshot and the restore re-mirrors them (localStorageSnapshot.ts)",
  pluginSettings:
    "carried as the payload's plugin_settings block, only the learner's keys " +
    "(lib/backup/pluginSettingsSnapshot.ts, #3412), not as table rows",
  aiValidationResults:
    "carried as the payload's ai_validation_results block (lib/backup/aiValidationSnapshot.ts, " +
    "#3412), not as table rows: no backup table outside the sync surface",
};

function schemaStores(): string[] {
  return getDb()
    .tables.map((table) => table.name)
    .sort();
}

function backedUpStores(): Set<string> {
  return new Set(Object.values(BACKUP_TABLES).map((spec) => spec.store));
}

afterEach(async () => {
  await _resetDbForTests();
});

describe("backup registry vs Dexie schema (#3419)", () => {
  it("every schema store is backed up or excluded with a reason", () => {
    const stores = schemaStores();
    // #2083 point 4: never pass on an empty enumeration.
    expect(stores.length, "no Dexie stores enumerated").toBeGreaterThan(30);
    const covered = backedUpStores();
    const undecided = stores.filter(
      (store) => !covered.has(store) && !(store in EXCLUDED_FROM_BACKUP_TABLES),
    );
    expect(undecided, `${stores.length} stores in the schema`).toEqual([]);
  });

  it("every BACKUP_TABLES store exists in the schema", () => {
    const stores = new Set(schemaStores());
    const unknown = [...backedUpStores()].filter((store) => !stores.has(store));
    expect(unknown).toEqual([]);
  });

  it("every exclusion is still needed", () => {
    const stores = new Set(schemaStores());
    const covered = backedUpStores();
    const stale = Object.keys(EXCLUDED_FROM_BACKUP_TABLES).filter(
      (store) => !stores.has(store) || covered.has(store),
    );
    expect(stale).toEqual([]);
  });
});
