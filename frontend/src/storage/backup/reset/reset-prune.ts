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

/**
 * Why a reset treats the shared tables (subject taxonomy, badge catalog)
 * differently from the content sets, although both are one store for every
 * learner in a browser (maintainer's decisions of 2026-11-26):
 *
 * - The sets are what the learner made or chose to download. A reset is
 *   asked to bring them exactly to the backup, and the dialog says that the
 *   other profiles see the same sets.
 * - Subjects and the badge catalog belong to no learner alone, and other
 *   learners' rows point at them. A reset neither deletes nor overwrites
 *   them; a backup's shared row is merged in as in a merge.
 *
 * This is a rule, not an oversight: do not align the two without a decision.
 * Server counterpart: ``SHARED_ROWS_KEEP_THE_MERGE_RULE`` in
 * ``backend/app/services/backup_reset.py``.
 */
export const SHARED_ROWS_KEEP_THE_MERGE_RULE = "global";

/**
 * A reset makes the learner's data exactly the backup's. With the backup of
 * another learner that would replace this learner by a copy of the other
 * one, which nobody asking for a reset means. The message names the reason,
 * not only the refusal; the server holds the same sentence.
 */
export const FOREIGN_BACKUP_RESET_REFUSED =
  "This backup belongs to another learner. A reset would replace everything of " +
  "the active learner with the other learner's data, so such a backup can only " +
  "be merged.";

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

/** Whether a reset makes this table's rows exactly the backup's. */
function isResetTable(table: string): boolean {
  const spec = BACKUP_TABLES[table];
  if (spec == null || spec.scope === SHARED_ROWS_KEEP_THE_MERGE_RULE) {
    return false;
  }
  return !KEPT_TABLES.has(table) && !SECRET_TABLES.has(table);
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
    if (!isResetTable(table)) continue;
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

/**
 * Name the first table whose rows are not exactly the backup's, else null.
 *
 * The check a reset runs before its transaction ends. Pruning and writing
 * follow rules made for the merge, which skips a row without an error when
 * it is another learner's. Where two learners in one browser hold the same
 * row id (one restored the other's backup), the reset would then delete the
 * learner's own rows and not bring the backup's back. Whatever the cause:
 * when the learner's rows are not the backup's rows afterwards, the reset
 * is not applied.
 *
 * @param data - The backup's tables, already re-homed onto ``userId``.
 */
export async function tableDifferingFromBackup(
  db: AdaptiveLearnerDB,
  data: Record<string, unknown>,
  userId: string,
): Promise<string | null> {
  const scopes = await scopedIdSets(db, userId);
  for (const table of RESTORE_ORDER) {
    if (!isResetTable(table)) continue;
    const expected = backupIds(table, data[table]);
    if (expected === null) continue;
    const spec = BACKUP_TABLES[table];
    const rows = await getTable(db, spec).toArray();
    const held = new Set(
      rowsBelongToUser(spec, rows, userId, scopes)
        .map((row) => row.id)
        .filter((id): id is string => typeof id === "string"),
    );
    const missing = [...expected].filter((id) => !held.has(id)).length;
    const extra = [...held].filter((id) => !expected.has(id)).length;
    if (missing > 0 || extra > 0) {
      return (
        `${table}: ${missing} row(s) of the backup could not be made this ` +
        `learner's and ${extra} row(s) outside it remained`
      );
    }
  }
  return null;
}
