/**
 * Dexie backup restore (#1806 — extracted from backup.ts).
 *
 * Merge semantics, never overwrite-all:
 *
 *   - Unknown id: insert from the backup, unless a unique index (a badge
 *     key, a per-user singleton) finds the local row; then that row is the
 *     known row, keeps its id, and children follow it (#3694).
 *   - Known id, append-only row: skip (history is immutable).
 *   - Known id, mutable row: keep the newer side
 *     (compare ``updated_at`` / ``assessed_at``).
 *
 * Live API keys are never overwritten by a backup file, even a
 * hand-edited one.
 */

import {getDb, type AdaptiveLearnerDB} from "../dexie/db";
import type {
    BackupPayload,
    RestoreSummary,
    RestoreTableSummary,
} from "../../types/domain";
import {restoreDexieContentSets} from "./backup-content-sets";
import {normalizeRestoreRecord} from "./backup-normalize";
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

/** Fresh all-zero per-table summary. */
export function emptyTableSummary(): RestoreTableSummary {
    return {inserted: 0, updated: 0, skipped: 0, errors: []};
}

/**
 * Validate the wire-shape. Throws a plain ``Error`` (the storage
 * layer is consumed by toast handlers that translate to user-
 * friendly messages).
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
    if (typeof obj.version !== "string" || obj.version === "") {
        throw new Error("Backup payload missing 'version'.");
    }
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
    if (spec.appendOnly) return "skipped";
    const matchedByUniqueKey = localId !== recordId;
    if (!matchedByUniqueKey && !backupIsNewer(record, existing, spec)) return "skipped";
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
            summary[await restoreRecord(store, table, spec, record, recordId, userId, idRemap)] += 1;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            summary.errors.push(`${table}/${recordId}: ${message}`);
            summary.skipped += 1;
        }
    }
    return summary;
}

/**
 * Apply a backup payload to the local IndexedDB. Merge semantics:
 * insert unknown ids, update mutable rows where the backup is
 * newer, skip duplicates for append-only rows. Never deletes.
 */
export async function restoreDexieBackup(
    userId: string,
    payload: BackupPayload,
): Promise<RestoreSummary> {
    validateBackupPayload(payload);
    const db = getDb();
    const data = payload.data;
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
            : await restoreOneTable(db, table, records as RowDict[], spec, userId, idRemap);
        perTable[table] = summary;
        totalInserted += summary.inserted;
        totalUpdated += summary.updated;
        totalSkipped += summary.skipped;
        allErrors.push(...summary.errors);
    }
    // Restore downloaded content sets into the cache (#130).
    const contentSummary = await restoreDexieContentSets(db, payload.content_sets);
    allErrors.push(...contentSummary.errors);
    return {
        user_id: userId,
        inserted: totalInserted,
        updated: totalUpdated,
        skipped: totalSkipped,
        errors: allErrors,
        tables: perTable,
        content_sets: contentSummary,
    };
}
