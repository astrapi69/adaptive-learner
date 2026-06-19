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
import {parse as parseYaml} from "yaml";

import {getDb, nowIso, type AdaptiveLearnerDB} from "./db";
import type {ContentSetRow, ContentSetFileRow} from "./db";
import type {
    BackupPayload,
    BackupStats,
    ContentSetBackupEntry,
    RestoreSummary,
    RestoreTableSummary,
} from "../types/domain";

export const BACKUP_FORMAT = "adaptive-learner-backup" as const;
// 1.4.0 — adds the optional ``local_storage`` snapshot block (P1 offline
// parity). Backward-compatible: a reader ignores the block it doesn't know,
// and a pre-1.4.0 backup simply lacks it (import then leaves localStorage
// untouched).
export const BACKUP_VERSION = "1.4.0";

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
        | "via_conversation" // row.conversation_id IN conversations of user
        | "global"; // row is shared across users (subjects taxonomy)
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
        // v1.8.0 / Phase 21B — session_notes is now mutable.
        // Backup-side timestampField stays at ``created_at`` for
        // chronological ordering of the dump; the sync surface
        // uses ``updated_at`` for conflict resolution
        // independently of backup.
        timestampField: "created_at",
        appendOnly: false,
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
        // Renamed v1.8.0 / Phase 21A to match the backend column.
        timestampField: "evaluated_at",
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
    // v1.9.0 / Phase 22A — taxonomy. Subjects are GLOBAL (the
    // entire taxonomy travels with the backup so a restore on
    // another device preserves the tree). Tags + project_*
    // associations are user-scoped through the existing helpers.
    subjects: {
        store: "subjects",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "global",
    },
    tags: {
        store: "tags",
        timestampField: "created_at",
        appendOnly: false,
        scope: "user",
    },
    project_subjects: {
        store: "projectSubjects",
        timestampField: "created_at",
        appendOnly: true,
        scope: "via_project",
    },
    project_tags: {
        store: "projectTags",
        timestampField: "created_at",
        appendOnly: true,
        scope: "via_project",
    },
    // BACKUP-DIR-EXPORT-01 — bring the Dexie backup up to parity
    // with the backend sync surface (``sync_service.TABLES``).
    // Before this, a Dexie-mode (GitHub Pages) export silently
    // dropped EVERY gamification / progress / SRS / missions row:
    // a backup looked complete but lost the user's actual learning
    // state. These mirror the backend specs one-for-one (all
    // ``scope="direct"`` -> Dexie ``"user"``, mutable, ``updated_at``;
    // ``badges`` is the GLOBAL catalog like ``subjects``).
    user_xp: {
        store: "userXp",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    badges: {
        store: "badges",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "global",
    },
    user_badges: {
        store: "userBadges",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    anki_card_suggestions: {
        store: "ankiCards",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    study_questions: {
        store: "studyQuestions",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    user_streaks: {
        store: "userStreaks",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    lesson_progress: {
        store: "lessonProgress",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    element_errors: {
        store: "elementErrors",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    user_missions: {
        store: "userMissions",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    // Phase 65 — API-key rollback cache. Carries Fernet ciphertext
    // (same scheme as ``UserSettings.api_key_*``). The backend syncs
    // and backs this up, so we mirror it for a "same file both
    // directions" guarantee. Unlike the plaintext ``api_key_*``
    // fields, the ciphertext is keyed to the install's secret and
    // is useless without it, so it is NOT stripped on export.
    api_key_backups: {
        store: "apiKeyBackups",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
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
    // v1.9.0 / Phase 22A — Subjects + Tags taxonomy. Subjects
    // before tags (no dependency); both before the M:N rows
    // that point at them.
    "subjects",
    "tags",
    "project_subjects",
    "project_tags",
    // BACKUP-DIR-EXPORT-01 — gamification / progress / SRS /
    // missions. ``badges`` (the catalog) before ``user_badges``
    // (which references a badge id); the rest are direct user-scope
    // rows with no cross-table FK inside the backup set.
    "user_xp",
    "badges",
    "user_badges",
    "anki_card_suggestions",
    "study_questions",
    "user_streaks",
    "lesson_progress",
    "element_errors",
    "user_missions",
    "api_key_backups",
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
        case "global":
            // GLOBAL rows (subjects taxonomy) belong to no user.
            // Every row in the table goes into the backup.
            return rows;
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

/** Slugify a ``owner/name`` source the same way the content cache key
 *  does (matches the backend ``slugify_source`` + Dexie ``cacheKey``). */
function slugifyContentSource(source: string): string {
    return source.replace(/\//g, "--");
}

/**
 * Restore downloaded content sets into IndexedDB (#130). A set already
 * present locally is skipped; a missing set is written to ``contentSets``
 * + ``contentSetFiles``. When the entry carries Dexie ``meta`` (a
 * Dexie-origin backup) the row is restored verbatim; otherwise (an
 * API-origin backup) a minimal row is synthesised from the manifest so
 * the lesson viewer — which reads ``contentSetFiles`` — can open lessons.
 */
async function restoreDexieContentSets(
    db: AdaptiveLearnerDB,
    entries: ContentSetBackupEntry[] | undefined,
): Promise<{restored: number; skipped: number; errors: string[]}> {
    const result = {restored: 0, skipped: 0, errors: [] as string[]};
    if (!Array.isArray(entries)) {
        return result;
    }
    for (const entry of entries) {
        const label = `${entry.source}/${entry.set_id}@v${entry.version}`;
        try {
            const setPk =
                typeof entry.meta?.id === "string" && entry.meta.id !== ""
                    ? (entry.meta.id as string)
                    : `${slugifyContentSource(entry.source)}/${entry.set_id}/${entry.version}`;
            if ((await db.contentSets.get(setPk)) != null) {
                result.skipped += 1;
                continue;
            }
            const row = buildContentSetRow(setPk, entry);
            const files: ContentSetFileRow[] = entry.files.map((file) => ({
                id: `${setPk}#${file.filename}`,
                set_pk: setPk,
                filename: file.filename,
                body: file.body,
                encoding: file.encoding,
            }));
            await db.transaction("rw", db.contentSets, db.contentSetFiles, async () => {
                await db.contentSets.put(row);
                await db.contentSetFiles.bulkPut(files);
            });
            result.restored += 1;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            result.errors.push(`${label}: ${message}`);
        }
    }
    return result;
}

/** Minimal shape of a content-set entry inside a ``manifest.yaml``
 *  (a subset of the content-loader's ``ParsedSet``) — the fields a
 *  restore needs to rebuild a ``ContentSetRow``. */
interface ManifestSetMeta {
    id?: string;
    title?: string;
    title_native?: string | null;
    language?: string;
    target_language?: string;
    source_language?: string;
    level?: string;
    domain?: string;
    description?: string | null;
    lesson_count?: number;
    tags?: string[];
    cover_image?: string | null;
}

/** Extract a set's metadata from a ``manifest.yaml`` body (#134).
 *
 *  Handles BOTH the real downloaded shape and the restore-synthesised
 *  shape, where the title lives under ``sets[].title`` (matched by
 *  ``set_id``, else the first set), with a root ``name`` / ``title``
 *  as a last resort. The previous ``/^title:/m`` regex only matched a
 *  root-level ``title:`` — which the synthesised manifest never has
 *  (it carries ``name:`` at the root and ``title:`` nested under
 *  ``sets``), so the title silently fell back to the raw ``set_id``.
 *
 *  Returns ``null`` when the body is absent / unparseable so the
 *  caller falls back to the carried ``meta`` or the ``set_id``. */
function parseManifestSetMeta(
    body: string | undefined,
    setId: string,
): ManifestSetMeta | null {
    if (!body) return null;
    try {
        const doc = parseYaml(body) as {
            name?: string;
            title?: string;
            sets?: ManifestSetMeta[];
        } | null;
        if (!doc) return null;
        if (Array.isArray(doc.sets) && doc.sets.length > 0) {
            const match =
                doc.sets.find((set) => set.id === setId) ?? doc.sets[0];
            return {
                ...match,
                // Inherit the root name/title only when the nested set
                // omits its own (defensive — synthesised sets carry it).
                title: match.title ?? doc.title ?? doc.name,
            };
        }
        const flatTitle = doc.title ?? doc.name;
        return flatTitle ? {title: flatTitle} : null;
    } catch {
        return null;
    }
}

/** Language fields for a restored ``ContentSetRow``, resolved from the
 *  carried Dexie ``meta`` first, then the parsed manifest, then a
 *  minimal default. ``language`` and ``target_language`` cross-fill so
 *  a row missing one but carrying the other stays usable. */
function resolveContentSetLanguages(
    meta: Partial<ContentSetRow>,
    fromManifest: ManifestSetMeta,
): Pick<ContentSetRow, "language" | "target_language" | "source_language"> {
    return {
        language:
            meta.language ??
            meta.target_language ??
            fromManifest.target_language ??
            fromManifest.language ??
            "",
        target_language:
            meta.target_language ??
            meta.language ??
            fromManifest.target_language ??
            fromManifest.language ??
            "",
        source_language:
            meta.source_language ?? fromManifest.source_language ?? "en",
    };
}

/** Descriptive text fields for a restored ``ContentSetRow``, resolved
 *  from the carried ``meta`` first, then the parsed manifest, then a
 *  minimal default. */
function resolveContentSetText(
    entry: ContentSetBackupEntry,
    meta: Partial<ContentSetRow>,
    fromManifest: ManifestSetMeta,
): Pick<
    ContentSetRow,
    "branch" | "title" | "title_native" | "level" | "domain" | "description" | "cover_image"
> {
    return {
        branch: entry.branch ?? meta.branch ?? "main",
        title: meta.title ?? fromManifest.title ?? entry.set_id,
        title_native: meta.title_native ?? fromManifest.title_native ?? null,
        level: meta.level ?? fromManifest.level ?? "",
        domain: meta.domain ?? fromManifest.domain ?? "language",
        description: meta.description ?? fromManifest.description ?? null,
        cover_image: meta.cover_image ?? fromManifest.cover_image ?? null,
    };
}

/** Build a ``ContentSetRow`` for restore: prefer the carried Dexie
 *  ``meta``, else recover the metadata from the manifest, else fall
 *  back to minimal defaults (lessons still open since the viewer reads
 *  the files, not the row). */
function buildContentSetRow(setPk: string, entry: ContentSetBackupEntry): ContentSetRow {
    const manifest = entry.files.find((file) => file.filename === "manifest.yaml");
    const fromManifest: ManifestSetMeta =
        parseManifestSetMeta(manifest?.body, entry.set_id) ?? {};
    const meta = (entry.meta ?? {}) as Partial<ContentSetRow>;
    const lessonCount = entry.files.filter((file) =>
        file.filename.startsWith("lessons/"),
    ).length;
    const manifestTags = Array.isArray(fromManifest.tags)
        ? JSON.stringify(fromManifest.tags)
        : undefined;
    return {
        id: setPk,
        source: entry.source,
        set_id: entry.set_id,
        version: entry.version,
        ...resolveContentSetText(entry, meta, fromManifest),
        ...resolveContentSetLanguages(meta, fromManifest),
        lesson_count: meta.lesson_count ?? fromManifest.lesson_count ?? lessonCount,
        tags: meta.tags ?? manifestTags ?? "[]",
        downloaded_at: meta.downloaded_at ?? nowIso(),
        manifest_yaml: meta.manifest_yaml ?? manifest?.body ?? "",
    };
}
