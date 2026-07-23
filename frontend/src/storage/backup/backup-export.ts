/**
 * Dexie backup export (#1806 — extracted from backup.ts).
 *
 * Builds the wire payload from IndexedDB: per-table stats for the
 * pre-restore diff UI, the full user-scoped dump (api keys stripped),
 * and the install-global content-set cache (#130) so a restore is
 * self-contained and user-generated sets survive.
 */

import {getDb, nowIso, type AdaptiveLearnerDB} from "../dexie/db";
import type {
    BackupPayload,
    BackupStats,
    ContentSetBackupEntry,
} from "../../types/domain";
import {
    getTable,
    rowsBelongToUser,
    scopedIdSets,
    stripExcludedFields,
    type RowDict,
} from "./backup-scope";
import {BACKUP_FORMAT, BACKUP_TABLES, BACKUP_VERSION} from "./backup-tables";

/**
 * Return per-table row counts for the user. Cheap; UI uses it to
 * show the "current vs incoming" diff before the user confirms a
 * restore.
 */
export async function getDexieBackupStats(
    userId: string,
): Promise<BackupStats & {user_id: string}> {
    const db = getDb();
    const scopes = await scopedIdSets(db, userId);
    const tables: Record<string, number> = {};
    for (const [name, spec] of Object.entries(BACKUP_TABLES)) {
        const all = await getTable(db, spec).toArray();
        tables[name] = rowsBelongToUser(spec, all, userId, scopes).length;
    }
    return {
        user_id: userId,
        total_records: Object.values(tables).reduce((sum, n) => sum + n, 0),
        tables,
    };
}

/**
 * Build a backup payload from IndexedDB. The shape mirrors the
 * backend so a Dexie-mode backup loads cleanly on an API install.
 */
export async function createDexieBackup(
    userId: string,
    appVersion: string,
): Promise<BackupPayload> {
    const db = getDb();
    const scopes = await scopedIdSets(db, userId);
    const data: Record<string, RowDict[]> = {};
    for (const [name, spec] of Object.entries(BACKUP_TABLES)) {
        const all = await getTable(db, spec).toArray();
        const scoped = rowsBelongToUser(spec, all, userId, scopes);
        data[name] = scoped.map((row) => stripExcludedFields(name, {...row}));
    }
    const tables: Record<string, number> = {};
    let total = 0;
    for (const [name, rows] of Object.entries(data)) {
        tables[name] = rows.length;
        total += rows.length;
    }
    const contentSets = await dumpDexieContentSets(db);
    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        app_version: appVersion,
        created_at: nowIso(),
        user_id: userId,
        storage_mode: "dexie",
        data,
        content_sets: contentSets,
        stats: {total_records: total, tables, content_sets: contentSets.length},
    };
}

/**
 * Serialise every downloaded content set from IndexedDB into the backup
 * wire model (#130). Content is install-global (not user-scoped); the
 * whole local cache is carried so a restore is self-contained and
 * user-generated sets — which exist ONLY in this cache — survive.
 */
async function dumpDexieContentSets(
    db: AdaptiveLearnerDB,
): Promise<ContentSetBackupEntry[]> {
    const rows = await db.contentSets.toArray();
    const entries: ContentSetBackupEntry[] = [];
    for (const row of rows) {
        const files = await db.contentSetFiles
            .where("set_pk")
            .equals(row.id)
            .toArray();
        entries.push({
            source: row.source,
            set_id: row.set_id,
            version: row.version,
            branch: row.branch,
            meta: {...row},
            files: files.map((file) => ({
                filename: file.filename,
                body: file.body,
                encoding: file.encoding,
            })),
        });
    }
    return entries;
}
