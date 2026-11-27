/**
 * Dexie backup restore (#1806 — extracted from backup.ts).
 *
 * Merge semantics, never overwrite-all:
 *
 *   - Unknown id: insert from the backup, unless a unique index (a badge
 *     key, a per-user singleton) finds the local row; then that row is the
 *     known row, keeps its id, and children follow it (#3694).
 *   - Known id, append-only row: skip (history is immutable).
 *   - Known id, lesson progress: merge field by field, whichever side is
 *     newer; a completion is never lost (``lessons/progress-merge.ts``, #3787).
 *   - Known id, other mutable row: keep the newer side
 *     (compare ``updated_at`` / ``assessed_at``).
 *
 * Live API keys are never overwritten by a backup file, even a
 * hand-edited one.
 *
 * The reset mode (#3787) is the other way to apply a backup: the device ends
 * up exactly at the backup's state. The learner's rows the backup does not
 * hold are deleted first (``reset/reset-prune.ts``), then every backup row
 * overwrites its local row whatever the timestamps say. It runs in one
 * transaction and is all or nothing.
 */

import {getDb, type AdaptiveLearnerDB} from "../dexie/db";
import {PROGRESS_TABLE, mergeLessonProgress} from "../lessons/progress-merge";
import {
    FOREIGN_BACKUP_RESET_REFUSED,
    SHARED_ROWS_KEEP_THE_MERGE_RULE,
    pruneRowsNotInBackup,
    tableDifferingFromBackup,
} from "./reset/reset-prune";
import type {
    BackupPayload,
    RestoreMode,
    RestoreOptions,
    RestoreSummary,
    RestoreTableSummary,
} from "../../types/domain";
import {restoreDexieContentSets} from "./backup-content-sets";
import {normalizeRestoreRecord} from "./backup-normalize";
import {backupOwnerId, rehomeBackupData} from "./backup-rehome";
import {
    findByUniqueIndex,
    redirectFks,
    rememberRemap,
    type IdRemap,
} from "./backup-unique-match";
import {
    dropApiKeyFields,
    getTable,
    parseTimestamp,
    recordBelongsToUser,
    type RowDict,
} from "./backup-scope";
import {
    BACKUP_FORMAT,
    BACKUP_TABLES,
    RESTORE_ORDER,
    SECRET_TABLES,
    type BackupTableSpec,
} from "./backup-tables";
import {assertReadableVersion, newerBackupReport} from "./backup-version";

/** Fresh all-zero per-table summary. */
export function emptyTableSummary(): RestoreTableSummary {
    return {inserted: 0, updated: 0, skipped: 0, errors: []};
}

/**
 * Validate the wire-shape. Throws a plain ``Error`` (the storage
 * layer is consumed by toast handlers that translate to user-
 * friendly messages), or a ``BackupVersionError`` for a format
 * version this build cannot read (#3827).
 */
export function validateBackupPayload(payload: unknown): asserts payload is BackupPayload {
    if (typeof payload !== "object" || payload === null) {
        throw new Error("Backup payload must be a JSON object.");
    }
    const obj = payload as Record<string, unknown>;
    if (obj.format !== BACKUP_FORMAT) {
        throw new Error(
            `Unrecognized backup format: ${JSON.stringify(obj.format)}. Expected ${JSON.stringify(BACKUP_FORMAT)}.`,
        );
    }
    assertReadableVersion(obj.version);
    if (typeof obj.data !== "object" || obj.data === null) {
        throw new Error("Backup payload missing 'data' segment.");
    }
}

type RowOutcome = "inserted" | "updated" | "skipped";

/** The row a backup record writes, with the never-restored fields dropped. */
function writableRow(table: string, record: RowDict): RowDict {
    return table === "user_settings" ? dropApiKeyFields(record) : {...record};
}

/** Whether the backup side of a mutable row is newer than the local one. */
function backupIsNewer(record: RowDict, existing: RowDict, spec: BackupTableSpec): boolean {
    const remoteTs = parseTimestamp(record[spec.timestampField]);
    const localTs = parseTimestamp(existing[spec.timestampField]);
    return remoteTs === null || localTs === null || remoteTs > localTs;
}

/**
 * What the merge does with a backup record whose id the device holds: the
 * one rule the restore and the pre-restore count share (#3787). An
 * append-only row is never rewritten, learner progress merges field by field
 * and counts only when that changes something, every other row follows the
 * newer timestamp.
 *
 * @example
 * if (mergeOutcome("tags", spec, record, existing) === "updated") updated += 1;
 */
export function mergeOutcome(
    table: string,
    spec: BackupTableSpec,
    record: RowDict,
    existing: RowDict,
): "updated" | "skipped" {
    if (spec.appendOnly) return "skipped";
    if (table === PROGRESS_TABLE) {
        return mergeLessonProgress(existing, writableRow(table, record)).changed
            ? "updated"
            : "skipped";
    }
    return backupIsNewer(record, existing, spec) ? "updated" : "skipped";
}

/**
 * Restore one record. A record unknown by id is looked up by the store's
 * unique index too (#3694): a catalog row or a singleton the device already
 * holds under another id is merged into that row and its id is remembered
 * for the child tables. Such a row is a local placeholder in the unique
 * slot, so the backup overwrites it regardless of timestamp, exactly as the
 * backend restore does (#115); a row with the backup's own id keeps the
 * newer-wins rule.
 */
async function restoreRecord(
    store: ReturnType<typeof getTable>,
    table: string,
    spec: BackupTableSpec,
    record: RowDict,
    recordId: string,
    userId: string,
    idRemap: IdRemap,
    mode: RestoreMode,
): Promise<RowOutcome> {
    const existing =
        ((await store.get(recordId)) as RowDict | undefined) ??
        (await findByUniqueIndex(store, record));
    if (existing == null) {
        if (!recordBelongsToUser(spec, record, userId)) return "skipped";
        await store.add(writableRow(table, record) as never);
        return "inserted";
    }
    const localId = String(existing.id);
    if (localId !== recordId) rememberRemap(idRemap, table, recordId, localId);
    // Existing row. Defensive scope check.
    if (spec.scope !== "self" && existing.user_id != null && existing.user_id !== userId) {
        return "skipped";
    }
    if (mode === "reset" && spec.scope !== SHARED_ROWS_KEEP_THE_MERGE_RULE) {
        // Shared rows keep the merge rule below (why: reset-prune.ts).
        // The backup's row replaces the local one, whichever is newer. The
        // settings row keeps the fields no backup carries (the AI keys).
        const row = writableRow(table, record);
        await store.put(
            (table === "user_settings"
                ? {...existing, ...row, id: localId}
                : {...row, id: localId}) as never,
        );
        return "updated";
    }
    if (spec.appendOnly) return "skipped";
    if (table === PROGRESS_TABLE) {
        // Learner progress merges field by field, whichever side is newer (#3787).
        const {row, changed} = mergeLessonProgress(existing, writableRow(table, record));
        if (!changed) return "skipped";
        await store.put({...row, id: localId} as never);
        return "updated";
    }
    const matchedByUniqueKey = localId !== recordId;
    if (!matchedByUniqueKey && mergeOutcome(table, spec, record, existing) === "skipped") {
        return "skipped";
    }
    // Keep the local PK; the spread keeps local-only fields.
    await store.put({...existing, ...writableRow(table, record), id: localId} as never);
    return "updated";
}

async function restoreOneTable(
    db: AdaptiveLearnerDB,
    table: string,
    records: RowDict[],
    spec: BackupTableSpec,
    userId: string,
    idRemap: IdRemap,
    mode: RestoreMode,
): Promise<RestoreTableSummary> {
    const summary = emptyTableSummary();
    const store = getTable(db, spec);
    for (const raw of records) {
        const record = redirectFks(table, normalizeRestoreRecord(table, raw), idRemap);
        const recordId = record.id;
        if (typeof recordId !== "string" || recordId === "") {
            summary.skipped += 1;
            summary.errors.push(`${table}: record missing 'id'`);
            continue;
        }
        try {
            summary[
                await restoreRecord(store, table, spec, record, recordId, userId, idRemap, mode)
            ] += 1;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            summary.errors.push(`${table}/${recordId}: ${message}`);
            summary.skipped += 1;
        }
    }
    return summary;
}

/**
 * Apply a backup payload to the local IndexedDB.
 *
 * ``merge`` (the default): insert unknown ids, update mutable rows where the
 * backup is newer, skip duplicates for append-only rows. Never deletes.
 *
 * ``reset`` (#3787): the device ends up exactly at the backup's state. One
 * transaction over every store: if any row cannot be applied, nothing is
 * changed and the call rejects.
 *
 * @example
 * await restoreDexieBackup(userId, payload, {mode: "reset"});
 */
export async function restoreDexieBackup(
    userId: string,
    payload: BackupPayload,
    options: RestoreOptions = {},
): Promise<RestoreSummary> {
    validateBackupPayload(payload);
    const db = getDb();
    // #3785 - another learner's backup lands under the local learner.
    const owner = backupOwnerId(payload);
    const data = rehomeBackupData(payload.data, owner, userId);
    if (options.mode !== "reset") return applyBackup(db, userId, payload, data, "merge");
    if (owner !== null && owner !== userId) throw new Error(FOREIGN_BACKUP_RESET_REFUSED);
    return db.transaction("rw", db.tables, async () => {
        await pruneRowsNotInBackup(db, data, userId);
        const summary = await applyBackup(db, userId, payload, data, "reset");
        if (summary.errors.length > 0) {
            // Throwing aborts the transaction: the rows deleted above are back.
            throw new Error(
                `The reset was not applied and the device is unchanged: ${summary.errors[0]}` +
                    (summary.errors.length > 1 ? ` (and ${summary.errors.length - 1} more)` : ""),
            );
        }
        const differing = await tableDifferingFromBackup(db, data, userId);
        if (differing !== null) {
            throw new Error(
                `The reset was not applied and the device is unchanged: ${differing}`,
            );
        }
        return summary;
    });
}

/** Write a backup's rows and sets; the shared body of both modes. */
async function applyBackup(
    db: AdaptiveLearnerDB,
    userId: string,
    payload: BackupPayload,
    data: ReturnType<typeof rehomeBackupData>,
    mode: RestoreMode,
): Promise<RestoreSummary> {
    const perTable: Record<string, RestoreTableSummary> = {};
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];
    // #3694 - backup ids matched to local rows under another id; badges are
    // restored before user_badges, so the earned badges redirect in time.
    const idRemap: IdRemap = new Map();
    for (const table of RESTORE_ORDER) {
        const spec = BACKUP_TABLES[table];
        if (spec == null) {
            continue;
        }
        const records = data[table];
        if (!Array.isArray(records)) {
            const summary = emptyTableSummary();
            if (records != null) {
                summary.errors.push(`${table}: expected list, got ${typeof records}`);
                allErrors.push(...summary.errors);
            }
            perTable[table] = summary;
            continue;
        }
        // #3367: a key row from a file never lands (a legacy Dexie file
        // carries cleartext, an API file carries another install's
        // ciphertext); each one counts as skipped.
        const summary = SECRET_TABLES.has(table)
            ? {...emptyTableSummary(), skipped: records.length}
            : await restoreOneTable(db, table, records as RowDict[], spec, userId, idRemap, mode);
        perTable[table] = summary;
        totalInserted += summary.inserted;
        totalUpdated += summary.updated;
        totalSkipped += summary.skipped;
        allErrors.push(...summary.errors);
    }
    // Restore downloaded content sets into the cache (#130).
    const contentSummary = await restoreDexieContentSets(db, payload.content_sets, mode);
    allErrors.push(...contentSummary.errors);
    return {
        user_id: userId,
        inserted: totalInserted,
        updated: totalUpdated,
        skipped: totalSkipped,
        errors: allErrors,
        tables: perTable,
        content_sets: contentSummary,
        // #3827 - a newer backup names what this build skipped in it.
        ...newerBackupReport(payload as unknown as Record<string, unknown>),
    };
}
