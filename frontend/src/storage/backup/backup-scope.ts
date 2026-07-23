/**
 * Backup scoping + row helpers (#1806 — extracted from backup.ts).
 *
 * The pure/query helpers shared by export and restore: resolving the
 * user's id sets (projects / curricula / sessions / conversations),
 * filtering rows per ``BackupTableSpec.scope``, stripping the
 * plaintext ``api_key_*`` fields, and timestamp parsing for the
 * newer-side-wins merge.
 */

import type {EntityTable} from "dexie";

import type {AdaptiveLearnerDB} from "../dexie/db";
import {EXCLUDED_USER_SETTINGS_FIELDS, type BackupTableSpec} from "./backup-tables";

export type RowDict = Record<string, unknown>;

/** Resolved per-user id sets used by the ``via_*`` scopes. */
export interface ScopedIdSets {
    projectIds: Set<string>;
    curriculumIds: Set<string>;
    sessionIds: Set<string>;
    conversationIds: Set<string>;
}

/** Dexie table handle for a spec, widened to the generic row shape. */
export function getTable(
    db: AdaptiveLearnerDB,
    spec: BackupTableSpec,
): EntityTable<RowDict, "id"> {
    return db[spec.store] as unknown as EntityTable<RowDict, "id">;
}

/** Collect the user's project / curriculum / session / conversation ids. */
export async function scopedIdSets(
    db: AdaptiveLearnerDB,
    userId: string,
): Promise<ScopedIdSets> {
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

/** Filter a table's rows down to the user per the spec's scope. */
export function rowsBelongToUser(
    spec: BackupTableSpec,
    rows: RowDict[],
    userId: string,
    scopes: ScopedIdSets,
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
        case "global":
            // GLOBAL rows (subjects taxonomy) belong to no user.
            // Every row in the table goes into the backup.
            return rows;
    }
}

/** Strip the ``api_key_*`` fields from an exported user_settings row. */
export function stripExcludedFields(table: string, row: RowDict): RowDict {
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

/** ISO timestamp -> epoch ms, or null when absent/unparseable. */
export function parseTimestamp(value: unknown): number | null {
    if (typeof value !== "string" || value === "") {
        return null;
    }
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
}

/** Defensive ownership check for an incoming restore record. */
export function recordBelongsToUser(
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
export function dropApiKeyFields(record: RowDict): RowDict {
    const out: RowDict = {};
    for (const [k, v] of Object.entries(record)) {
        if (!EXCLUDED_USER_SETTINGS_FIELDS.has(k)) {
            out[k] = v;
        }
    }
    return out;
}
