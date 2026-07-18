/**
 * Dexie backup restore (#1806 — extracted from backup.ts).
 *
 * Merge semantics, never overwrite-all:
 *
 *   - Unknown id: insert from the backup.
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

async function restoreOneTable(
    db: AdaptiveLearnerDB,
    table: string,
    records: RowDict[],
    spec: BackupTableSpec,
    userId: string,
): Promise<RestoreTableSummary> {
    const summary = emptyTableSummary();
    const store = getTable(db, spec);
    for (const record of records) {
        const recordId = record.id;
        if (typeof recordId !== "string" || recordId === "") {
            summary.skipped += 1;
            summary.errors.push(`${table}: record missing 'id'`);
            continue;
        }
        try {
            const existing = (await store.get(recordId)) as RowDict | undefined;
            if (existing == null) {
                if (!recordBelongsToUser(spec, record, userId)) {
                    summary.skipped += 1;
                    continue;
                }
                const insertRow =
                    table === "user_settings" ? dropApiKeyFields(record) : {...record};
                await store.add(insertRow as never);
                summary.inserted += 1;
                continue;
            }
            // Existing row. Defensive scope check.
            if (
                spec.scope !== "self" &&
                "user_id" in existing &&
                existing.user_id != null &&
                existing.user_id !== userId
            ) {
                summary.skipped += 1;
                continue;
            }
            if (spec.appendOnly) {
                summary.skipped += 1;
                continue;
            }
            const remoteTs = parseTimestamp(record[spec.timestampField]);
            const localTs = parseTimestamp(existing[spec.timestampField]);
            if (remoteTs === null || localTs === null || remoteTs > localTs) {
                const updateRow =
                    table === "user_settings" ? dropApiKeyFields(record) : {...record};
                // Preserve the existing PK; .put would overwrite the
                // whole row including any local-only fields, which
                // is the intended behaviour here.
                await store.put({...existing, ...updateRow, id: recordId} as never);
                summary.updated += 1;
            } else {
                summary.skipped += 1;
            }
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
        const summary = await restoreOneTable(db, table, records as RowDict[], spec, userId);
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
