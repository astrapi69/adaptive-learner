/**
 * Client-side backup diff engine (v1.12.0 / Phase 25A).
 *
 * Given two parsed ``BackupPayload`` objects, computes a per-table
 * diff that the Compare UI renders. The engine is entirely
 * client-side — no backend roundtrip; the same code runs in both
 * storage modes.
 *
 * Matching rule:
 *   - UUID-based: two records are "the same record" iff they share
 *     ``id``. Append-only tables (sessions / messages / commits /
 *     etc.) only surface added + removed deltas. Mutable tables
 *     additionally surface field-level changes on rows present in
 *     both sides.
 *
 * Performance:
 *   - Async + chunked. Large backups (10k+ messages) process in
 *     1000-record chunks and yield control to the browser between
 *     chunks so the UI thread can repaint. Optional
 *     ``onProgress`` callback fires once per table for progress UI.
 *   - Uses ``Map<id, row>`` lookups (O(1) per row) so total work
 *     is O(N+M) per table, not O(N*M).
 *
 * Excluded fields: ``api_key_*`` columns on ``user_settings`` are
 * already stripped at backup-write time (see ``storage/backup.ts``
 * ``EXCLUDED_USER_SETTINGS_FIELDS``); the diff engine doesn't have
 * to re-filter.
 */

import type {BackupPayload} from "../types/domain";

export const APPEND_ONLY_TABLES: ReadonlySet<string> = new Set([
    "learning_sessions",
    "session_messages",
    "session_ratings",
    "progress_commits",
    "method_switches",
    "step_evaluations",
    "imported_conversations",
    "imported_messages",
    "project_subjects",
    "project_tags",
]);

/**
 * Tables for which the diff renders a count summary instead of
 * one-line previews per record (too noisy for the Markdown
 * report + the expand-table view).
 */
export const HIGH_VOLUME_TABLES: ReadonlySet<string> = new Set([
    "session_messages",
    "imported_messages",
    "step_evaluations",
]);

/**
 * Fields that change with every write but carry no user-visible
 * semantics. Excluded from the change-detection comparison so a
 * mere re-export doesn't surface every row as "changed".
 */
const FIELD_BLACKLIST: ReadonlySet<string> = new Set([
    "updated_at",
    // ``created_at`` IS meaningful (the moment a row was first
    // written) but unchangeable after the fact, so its presence
    // in a diff means a record id collision — we leave it in so
    // the user sees the surprise.
]);

export interface DiffRecord {
    id: string;
    preview: string;
}

export interface FieldChange {
    field: string;
    old_value: unknown;
    new_value: unknown;
}

export interface ChangedRecord {
    id: string;
    preview: string;
    fields: FieldChange[];
}

export interface TableDiff {
    table: string;
    append_only: boolean;
    high_volume: boolean;
    added: DiffRecord[];
    removed: DiffRecord[];
    changed: ChangedRecord[];
    unchanged: number;
    total_old: number;
    total_new: number;
}

export interface BackupDiff {
    backup_a: BackupSummary;
    backup_b: BackupSummary;
    tables: TableDiff[];
    totals: {
        added: number;
        removed: number;
        changed: number;
        unchanged: number;
    };
}

export interface BackupSummary {
    created_at: string;
    app_version: string | null;
    user_id: string;
    storage_mode: "api" | "dexie";
    total_records: number;
}

type Row = Record<string, unknown>;

const CHUNK_SIZE = 1000;

/**
 * Yield to the event loop between chunks so the browser can
 * paint. ``requestIdleCallback`` when available; ``setTimeout 0``
 * fallback for Safari + tests (happy-dom has neither RIC nor a
 * real event loop, but setTimeout 0 settles quickly).
 */
function yieldToBrowser(): Promise<void> {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        return new Promise((resolve) => window.requestIdleCallback(() => resolve()));
    }
    return new Promise((resolve) => setTimeout(resolve, 0));
}

export interface DiffOptions {
    /** Called once per table when its diff is complete. */
    onProgress?: (table: string, completed: number, total: number) => void;
    /** Pin chunk size for testing. */
    chunkSize?: number;
}

/**
 * Compare two backup payloads. Returns the full per-table diff
 * structure. Yields between table chunks for large backups so the
 * UI stays responsive.
 */
export async function diffBackups(
    a: BackupPayload,
    b: BackupPayload,
    opts: DiffOptions = {},
): Promise<BackupDiff> {
    const chunkSize = opts.chunkSize ?? CHUNK_SIZE;
    const tableNames = collectTableNames(a, b);

    const tables: TableDiff[] = [];
    let totalAdded = 0;
    let totalRemoved = 0;
    let totalChanged = 0;
    let totalUnchanged = 0;

    for (let i = 0; i < tableNames.length; i += 1) {
        const name = tableNames[i];
        const oldRows = (a.data?.[name] ?? []) as Row[];
        const newRows = (b.data?.[name] ?? []) as Row[];
        const tableDiff = await diffTable(name, oldRows, newRows, chunkSize);
        tables.push(tableDiff);
        totalAdded += tableDiff.added.length;
        totalRemoved += tableDiff.removed.length;
        totalChanged += tableDiff.changed.length;
        totalUnchanged += tableDiff.unchanged;
        opts.onProgress?.(name, i + 1, tableNames.length);
        await yieldToBrowser();
    }

    return {
        backup_a: payloadSummary(a),
        backup_b: payloadSummary(b),
        tables,
        totals: {
            added: totalAdded,
            removed: totalRemoved,
            changed: totalChanged,
            unchanged: totalUnchanged,
        },
    };
}

function collectTableNames(a: BackupPayload, b: BackupPayload): string[] {
    const names = new Set<string>();
    for (const name of Object.keys(a.data ?? {})) names.add(name);
    for (const name of Object.keys(b.data ?? {})) names.add(name);
    return Array.from(names).sort();
}

function payloadSummary(p: BackupPayload): BackupSummary {
    return {
        created_at: p.created_at,
        app_version: p.app_version ?? null,
        user_id: p.user_id,
        storage_mode: p.storage_mode,
        total_records: p.stats?.total_records ?? 0,
    };
}

async function diffTable(
    table: string,
    oldRows: Row[],
    newRows: Row[],
    chunkSize: number,
): Promise<TableDiff> {
    const appendOnly = APPEND_ONLY_TABLES.has(table);
    const highVolume = HIGH_VOLUME_TABLES.has(table);

    const oldMap = new Map<string, Row>();
    for (const row of oldRows) {
        const id = rowId(row);
        if (id) oldMap.set(id, row);
    }
    const newMap = new Map<string, Row>();
    for (const row of newRows) {
        const id = rowId(row);
        if (id) newMap.set(id, row);
    }

    const added: DiffRecord[] = [];
    const removed: DiffRecord[] = [];
    const changed: ChangedRecord[] = [];
    let unchanged = 0;

    let counter = 0;
    for (const [id, newRow] of newMap) {
        const oldRow = oldMap.get(id);
        if (oldRow === undefined) {
            added.push({id, preview: previewRow(table, newRow)});
        } else if (appendOnly) {
            // Append-only: presence in both sides = unchanged. We
            // don't surface a fielded diff because the row's
            // history is immutable by contract.
            unchanged += 1;
        } else {
            const fields = diffFields(oldRow, newRow);
            if (fields.length === 0) {
                unchanged += 1;
            } else {
                changed.push({id, preview: previewRow(table, newRow), fields});
            }
        }
        counter += 1;
        if (counter % chunkSize === 0) {
            await yieldToBrowser();
        }
    }
    for (const [id, oldRow] of oldMap) {
        if (!newMap.has(id)) {
            removed.push({id, preview: previewRow(table, oldRow)});
            counter += 1;
            if (counter % chunkSize === 0) {
                await yieldToBrowser();
            }
        }
    }

    return {
        table,
        append_only: appendOnly,
        high_volume: highVolume,
        added,
        removed,
        changed,
        unchanged,
        total_old: oldRows.length,
        total_new: newRows.length,
    };
}

function rowId(row: Row): string | null {
    const id = row.id;
    return typeof id === "string" && id.length > 0 ? id : null;
}

function diffFields(oldRow: Row, newRow: Row): FieldChange[] {
    const fields = new Set<string>();
    for (const key of Object.keys(oldRow)) fields.add(key);
    for (const key of Object.keys(newRow)) fields.add(key);
    const changes: FieldChange[] = [];
    for (const field of fields) {
        if (FIELD_BLACKLIST.has(field)) continue;
        const oldVal = oldRow[field];
        const newVal = newRow[field];
        if (!deepEqual(oldVal, newVal)) {
            changes.push({field, old_value: oldVal, new_value: newVal});
        }
    }
    // Sort alphabetically so the rendered diff is stable.
    changes.sort((a, b) => (a.field < b.field ? -1 : a.field > b.field ? 1 : 0));
    return changes;
}

function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const keys = new Set<string>([...Object.keys(ao), ...Object.keys(bo)]);
    for (const k of keys) {
        if (!deepEqual(ao[k], bo[k])) return false;
    }
    return true;
}

// ---- Previews per table ------------------------------------------------

/**
 * Per-table preview builders. Each returns a compact, human-meaningful
 * one-line label for a row; tables without an entry fall through to the
 * id-only default in {@link previewRow}.
 */
const ROW_PREVIEWS: Record<string, (row: Row) => string> = {
    users: (row) => `${row.name ?? row.id}`,
    learning_projects: (row) =>
        `${row.topic ?? row.id} (${row.daily_minutes ?? "?"} min/day)`,
    learning_profiles: (row) => `Profile ${asDate(row.assessed_at)}`,
    user_settings: (row) => `Settings (${row.active_provider ?? "?"})`,
    curriculums: (row) => `${row.title ?? row.id}`,
    learning_topics: (row) => `${row.title ?? row.id}`,
    lessons: (row) => `${row.title ?? row.id}`,
    learning_sessions: (row) =>
        `${asDate(row.started_at)} ${row.method ?? "?"} (step ${
            row.cycle_step ?? "?"
        })`,
    session_messages: (row) => {
        const content = String(row.content ?? "").slice(0, 60);
        return `[${row.role ?? "?"}] ${content}${
            String(row.content ?? "").length > 60 ? "…" : ""
        }`;
    },
    session_ratings: (row) =>
        `Rating u${row.understanding ?? "?"}/s${row.stress ?? "?"}/m${row.method_fit ?? "?"}`,
    session_notes: (row) => {
        const note = String(row.content ?? "").slice(0, 60);
        return `Note: ${note}${String(row.content ?? "").length > 60 ? "…" : ""}`;
    },
    progress_commits: (row) =>
        `Commit ${asDate(row.committed_at)} (${row.duration_minutes ?? "?"} min)`,
    method_switches: (row) => `${row.from_method ?? "?"} → ${row.to_method ?? "?"}`,
    step_evaluations: (row) =>
        `Eval step ${row.from_step ?? "?"} → ${row.to_step ?? "?"} (${
            row.confidence ?? "?"
        })`,
    imported_conversations: (row) => `${row.title ?? row.id}`,
    imported_messages: (row) => {
        const content = String(row.content ?? "").slice(0, 60);
        return `[${row.role ?? "?"}] ${content}${
            String(row.content ?? "").length > 60 ? "…" : ""
        }`;
    },
    subjects: (row) => `${row.name ?? row.id}`,
    tags: (row) => `${row.name ?? row.id}`,
    project_subjects: (row) =>
        `proj ${shortId(row.project_id)} ↔ subj ${shortId(row.subject_id)}`,
    project_tags: (row) =>
        `proj ${shortId(row.project_id)} ↔ tag ${shortId(row.tag_id)}`,
};

/**
 * One-liner preview per row. Used by the Compare UI and the
 * Markdown export to identify a record without dumping its full
 * column set. Each table picks the two or three most
 * human-meaningful fields; everything else falls through to the
 * id-only default.
 */
export function previewRow(table: string, row: Row): string {
    const builder = ROW_PREVIEWS[table];
    return builder ? builder(row) : String(row.id ?? "(no id)");
}

function asDate(value: unknown): string {
    if (typeof value !== "string" || value.length === 0) return "(no date)";
    // Show only the YYYY-MM-DD prefix for compact previews.
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : value;
}

function shortId(value: unknown): string {
    return typeof value === "string" ? value.slice(0, 8) : "?";
}

// ---- Filter / sort helpers -----------------------------------------------

export function filterChangedTables(tables: TableDiff[]): TableDiff[] {
    return tables.filter(
        (t) => t.added.length + t.removed.length + t.changed.length > 0,
    );
}

export function sortTablesByDelta(tables: TableDiff[]): TableDiff[] {
    return [...tables].sort((a, b) => {
        const da = a.added.length + a.removed.length + a.changed.length;
        const db = b.added.length + b.removed.length + b.changed.length;
        return db - da;
    });
}

export function sortTablesAlphabetically(tables: TableDiff[]): TableDiff[] {
    return [...tables].sort((a, b) => a.table.localeCompare(b.table));
}

export const __test__ = {diffFields, deepEqual, asDate};
