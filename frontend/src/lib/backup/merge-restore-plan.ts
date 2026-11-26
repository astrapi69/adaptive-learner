/**
 * What a merge restore will do to the device, counted before it runs (#3787).
 *
 * The pre-restore preview used the plain diff of two payloads, which calls
 * every differing row "changed". The merge updates a row only where the
 * backup is newer, never rewrites an append-only row and never deletes, so
 * the button promised updates the restore then skipped. This walks the
 * backup the way the restore does and asks the restore's own rule
 * ({@link mergeOutcome}) for each row the device holds.
 *
 * Two things it cannot see, because it reads a snapshot and not the
 * database: a backup row the device holds under another id (matched by a
 * unique index, #3694) counts here as added and is an update in the restore;
 * and in API mode the backend applies its own copy of the rule.
 *
 * @example
 * const plan = planMergeRestore(currentSnapshot, pendingPayload, userId);
 * // plan = {added: 76, updated: 12}
 */

import {
  backupOwnerId,
  rehomeBackupData,
} from "../../storage/backup/backup-rehome";
import { normalizeRestoreRecord } from "../../storage/backup/backup-normalize";
import { mergeOutcome } from "../../storage/backup/backup-restore";
import {
  recordBelongsToUser,
  type RowDict,
} from "../../storage/backup/backup-scope";
import {
  BACKUP_TABLES,
  SECRET_TABLES,
} from "../../storage/backup/backup-tables";
import type { BackupPayload } from "../../types/domain";

/** The rows a merge restore inserts and updates. */
export interface MergeRestorePlan {
  added: number;
  updated: number;
}

/**
 * Count the inserts and updates a merge of ``backup`` into the device makes.
 *
 * @param current - The device's state as a backup payload.
 * @param backup - The backup about to be restored.
 * @param userId - The active learner; another learner's backup is re-homed
 *   onto it first, as the restore does (#3785).
 */
export function planMergeRestore(
  current: BackupPayload,
  backup: BackupPayload,
  userId: string,
): MergeRestorePlan {
  const data = rehomeBackupData(backup.data, backupOwnerId(backup), userId);
  const plan: MergeRestorePlan = { added: 0, updated: 0 };
  for (const [table, spec] of Object.entries(BACKUP_TABLES)) {
    const records = data[table];
    if (SECRET_TABLES.has(table) || !Array.isArray(records)) continue;
    const held = new Map(
      (current.data[table] ?? []).map((row) => [
        String(row.id),
        row as RowDict,
      ]),
    );
    for (const raw of records) {
      const record = normalizeRestoreRecord(table, raw as RowDict);
      if (typeof record.id !== "string" || record.id === "") continue;
      const existing = held.get(record.id);
      if (existing === undefined) {
        if (recordBelongsToUser(spec, record, userId)) plan.added += 1;
      } else if (mergeOutcome(table, spec, record, existing) === "updated") {
        plan.updated += 1;
      }
    }
  }
  return plan;
}
