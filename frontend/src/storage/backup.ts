/**
 * Backup + restore for Dexie mode (Phase 15B).
 *
 * Mirrors the backend's ``backup_service.py`` byte-for-byte so the
 * same JSON file works in both directions. A Dexie-mode backup
 * loads cleanly on an API/SQLite install via ``POST /api/backup/import``
 * and vice versa.
 *
 * Restore semantics are MERGE, not overwrite:
 *
 *   - Unknown id: insert from the backup.
 *   - Known id, append-only row: skip (history is immutable).
 *   - Known id, mutable row: keep the newer side
 *     (compare ``updated_at`` / ``assessed_at``).
 *
 * API keys (``api_key_anthropic`` / ``api_key_openai`` /
 * ``api_key_gemini``) are stripped on export and ignored on import,
 * even if a hand-edited file carries them. The live ``UserSettings``
 * row keeps whatever keys the user has set locally.
 */

import type {EntityTable} from "dexie";

import {getDb, nowIso, type AdaptiveLearnerDB} from "./db";
import type {
    BackupPayload,
    BackupStats,
    RestoreSummary,
    RestoreTableSummary,
} from "../types/domain";

export const BACKUP_FORMAT = "adaptive-learner-backup" as const;
export const BACKUP_VERSION = "1.2.0";

export const EXCLUDED_USER_SETTINGS_FIELDS: ReadonlySet<string> = new Set([
    "api_key_anthropic",
    "api_key_openai",
    "api_key_gemini",
]);

/**
 * Backup-table descriptor. ``store`` is the Dexie table name;
 * ``filter`` says how to scope by user. ``append_only`` flips the
 * restore behaviour (skip duplicates vs newer-side-wins).
 */
interface BackupTableSpec {
    store: keyof AdaptiveLearnerDB & string;
    timestampField: string;
    appendOnly: boolean;
    scope:
        | "self" // the row IS the user (users table)
        | "user" // row.user_id == userId
        | "via_curriculum" // row.curriculum_id IN curriculums of user
        | "via_project" // row.project_id IN projects of user
        | "via_session" // row.session_id IN sessions of user
        | "via_conversation"; // row.conversation_id IN conversations of user
}

const BACKUP_TABLES: Record<string, BackupTableSpec> = {
    users: {
        store: "users",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "self",
    },
    user_settings: {
        store: "userSettings",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    learning_projects: {
        store: "learningProjects",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    learning_profiles: {
        store: "learningProfiles",
        timestampField: "assessed_at",
        appendOnly: false,
        scope: "user",
    },
    curriculums: {
        store: "curricula",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    learning_topics: {
        store: "learningTopics",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "via_curriculum",
    },
    lessons: {
        store: "lessons",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "via_curriculum",
    },
    learning_sessions: {
        store: "learningSessions",
        timestampField: "started_at",
        appendOnly: true,
        scope: "via_project",
    },
    session_messages: {
        store: "sessionMessages",
        timestampField: "created_at",
        appendOnly: true,
        scope: "via_session",
    },
    session_ratings: {
        store: "sessionRatings",
        timestampField: "created_at",
        appendOnly: true,
        scope: "via_session",
    },
    session_notes: {
        store: "sessionNotes",
        timestampField: "created_at",
        appendOnly: true,
        scope: "via_session",
    },
    progress_commits: {
        store: "progressCommits",
        timestampField: "committed_at",
        appendOnly: true,
        scope: "via_project",
    },
    method_switches: {
        store: "methodSwitches",
        timestampField: "switched_at",
        appendOnly: true,
        scope: "via_project",
    },
    step_evaluations: {
        store: "stepEvaluations",
        timestampField: "created_at",
        appendOnly: true,
        scope: "via_session",
    },
    imported_conversations: {
        store: "importedConversations",
        timestampField: "imported_at",
        appendOnly: true,
        scope: "user",
    },
    imported_messages: {
        store: "importedMessages",
        timestampField: "timestamp",
        appendOnly: true,
        scope: "via_conversation",
    },
};

/**
 * Order matters for restore: parents before children. Mutable
 * parents first, then the append-only history, then imports.
 */
const RESTORE_ORDER: readonly string[] = [
    "users",
    "user_settings",
    "learning_projects",
    "learning_profiles",
    "curriculums",
    "learning_topics",
    "lessons",
    "learning_sessions",
    "session_messages",
    "session_ratings",
    "session_notes",
    "progress_commits",
    "method_switches",
    "step_evaluations",
    "imported_conversations",
    "imported_messages",
];

// ---- Helpers -----------------------------------------------------------

type RowDict = Record<string, unknown>;

function getTable(
    db: AdaptiveLearnerDB,
    spec: BackupTableSpec,
): EntityTable<RowDict, "id"> {
    return db[spec.store] as unknown as EntityTable<RowDict, "id">;
}

async function scopedIdSets(
    db: AdaptiveLearnerDB,
    userId: string,
): Promise<{
    projectIds: Set<string>;
    curriculumIds: Set<string>;
    sessionIds: Set<string>;
    conversationIds: Set<string>;
}> {
    const projects = await db.learningProjects
        .where("user_id")
        .equals(userId)
        .toArray();
    const projectIds = new Set(projects.map((row) => row.id));
    const curricula = await db.curricula
        .where("user_id")
        .equals(userId)
        .toArray();
    const curriculumIds = new Set(curricula.map((row) => row.id));
    const allSessions = await db.learningSessions.toArray();
    const sessionIds = new Set(
        allSessions
            .filter((row) => projectIds.has(row.project_id))
            .map((row) => row.id),
    );
    const conversations = await db.importedConversations
        .where("user_id")
        .equals(userId)
        .toArray();
    const conversationIds = new Set(conversations.map((row) => row.id));
    return {projectIds, curriculumIds, sessionIds, conversationIds};
}

function rowsBelongToUser(
    spec: BackupTableSpec,
    rows: RowDict[],
    userId: string,
    scopes: {
        projectIds: Set<string>;
        curriculumIds: Set<string>;
        sessionIds: Set<string>;
        conversationIds: Set<string>;
    },
): RowDict[] {
    switch (spec.scope) {
        case "self":
            return rows.filter((row) => row.id === userId);
        case "user":
            return rows.filter((row) => row.user_id === userId);
        case "via_curriculum":
            return rows.filter(
                (row) =>
                    typeof row.curriculum_id === "string" &&
                    scopes.curriculumIds.has(row.curriculum_id),
            );
        case "via_project":
            return rows.filter(
                (row) =>
                    typeof row.project_id === "string" &&
                    scopes.projectIds.has(row.project_id),
            );
        case "via_session":
            return rows.filter(
                (row) =>
                    typeof row.session_id === "string" &&
                    scopes.sessionIds.has(row.session_id),
            );
        case "via_conversation":
            return rows.filter(
                (row) =>
                    typeof row.conversation_id === "string" &&
                    scopes.conversationIds.has(row.conversation_id),
            );
    }
}

function stripExcludedFields(table: string, row: RowDict): RowDict {
    if (table !== "user_settings") {
        return row;
    }
    const out: RowDict = {};
    for (const [k, v] of Object.entries(row)) {
        if (!EXCLUDED_USER_SETTINGS_FIELDS.has(k)) {
            out[k] = v;
        }
    }
    return out;
}

function parseTimestamp(value: unknown): number | null {
    if (typeof value !== "string" || value === "") {
        return null;
    }
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
}

function recordBelongsToUser(
    spec: BackupTableSpec,
    record: RowDict,
    userId: string,
): boolean {
    if (spec.scope === "self") {
        return record.id === userId;
    }
    if ("user_id" in record && record.user_id != null) {
        return record.user_id === userId;
    }
    return true;
}

/**
 * Strip the three ``api_key_*`` fields from a user_settings
 * record before INSERT/UPDATE. Live keys must never be overwritten
 * by a backup file (even a hand-edited one).
 */
function dropApiKeyFields(record: RowDict): RowDict {
    const out: RowDict = {};
    for (const [k, v] of Object.entries(record)) {
        if (!EXCLUDED_USER_SETTINGS_FIELDS.has(k)) {
            out[k] = v;
        }
    }
    return out;
}

// ---- Public API --------------------------------------------------------

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
    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        app_version: appVersion,
        created_at: nowIso(),
        user_id: userId,
        storage_mode: "dexie",
        data,
        stats: {total_records: total, tables},
    };
}

function emptyTableSummary(): RestoreTableSummary {
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
    return {
        user_id: userId,
        inserted: totalInserted,
        updated: totalUpdated,
        skipped: totalSkipped,
        errors: allErrors,
        tables: perTable,
    };
}
