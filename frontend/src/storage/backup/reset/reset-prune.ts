/**
 * The deleting half of a reset restore (#3787): remove the learner's rows the
 * backup does not hold, so that what is left after the restore is exactly
 * the backup's state.
 *
 * Deliberately not removed:
 *
 * - the learner's own ``users`` row and the ``user_settings`` row, which
 *   carries the AI keys no backup holds; the restore overwrites their other
 *   fields;
 * - the secret tables (#3367) and the tables shared across learners;
 * - the rows of a table the backup does not carry at all (a backup written
 *   before the table existed says nothing about it);
 * - every other learner's rows.
 *
 * Runs inside the caller's transaction, children before parents.
 *
 * @example
 * await db.transaction("rw", db.tables, async () => {
 *   await pruneRowsNotInBackup(db, data, userId);
 *   // ... write the backup's rows
 * });
 */

import type { AdaptiveLearnerDB } from "../../dexie/db";
import {
  getTable,
  rowsBelongToUser,
  scopedIdSets,
  type RowDict,
} from "../backup-scope";
import { normalizeRestoreRecord } from "../backup-normalize";
import { BACKUP_TABLES, RESTORE_ORDER, SECRET_TABLES } from "../backup-tables";

/** Tables whose rows a reset overwrites in place and never deletes. */
const KEPT_TABLES: ReadonlySet<string> = new Set(["users", "user_settings"]);

/** The ids the backup holds for one table, or ``null`` when it does not
 *  carry the table. */
function backupIds(table: string, records: unknown): Set<string> | null {
  if (!Array.isArray(records)) return null;
  // The id a record is written under, which for some tables is built from
  // its fields on the way in (backup-normalize.ts).
  return new Set(
    records
      .map((record) => normalizeRestoreRecord(table, record as RowDict).id)
      .filter((id): id is string => typeof id === "string"),
  );
}

/**
 * Delete the learner's rows that the backup does not hold.
 *
 * @param data - The backup's tables, already re-homed onto ``userId``.
 * @returns How many rows were deleted.
 */
export async function pruneRowsNotInBackup(
  db: AdaptiveLearnerDB,
  data: Record<string, unknown>,
  userId: string,
): Promise<number> {
  // Read before the first delete: the ``via_*`` scopes follow parent rows.
  const scopes = await scopedIdSets(db, userId);
  let deleted = 0;
  for (const table of [...RESTORE_ORDER].reverse()) {
    const spec = BACKUP_TABLES[table];
    if (spec == null || spec.scope === "global") continue;
    if (KEPT_TABLES.has(table) || SECRET_TABLES.has(table)) continue;
    const keep = backupIds(table, data[table]);
    if (keep === null) continue;
    const store = getTable(db, spec);
    const own = rowsBelongToUser(spec, await store.toArray(), userId, scopes);
    const gone = own
      .map((row) => row.id)
      .filter((id): id is string => typeof id === "string" && !keep.has(id));
    await store.bulkDelete(gone);
    deleted += gone.length;
  }
  return deleted;
}
