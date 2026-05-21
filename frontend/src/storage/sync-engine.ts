/**
 * Cross-device sync engine (Phase 13C).
 *
 * Drives the full bidirectional sync between a Dexie-backed
 * frontend and a remote FastAPI backend. The engine owns:
 *
 *   1. Pairing state (host, port, user_id, paired_at, device_name)
 *      persisted in localStorage.
 *   2. Last-sync timestamp (per-device).
 *   3. Sync history (last 5 runs, for the Settings panel).
 *   4. The push/pull/resolve protocol that mirrors the backend
 *      ``/api/sync/*`` endpoints.
 *
 * The 12 sync-table set:
 *
 *   MUTABLE   users, user_settings, learning_projects,
 *             learning_profiles, curriculums, learning_topics, lessons
 *   APPEND    learning_sessions, session_messages, session_ratings,
 *             session_notes, progress_commits, method_switches,
 *             step_evaluations, imported_conversations,
 *             imported_messages
 *
 * v1.8.0 / Phase 21 — closed the v1.0.0 sync gaps. The Dexie
 * schema for ``step_evaluations`` was aligned with the backend
 * (``suggested_step`` -> ``to_step``, ``created_at`` ->
 * ``evaluated_at``) via the v3 schema upgrade; ``session_notes``
 * + ``imported_conversations`` + ``imported_messages`` joined
 * the surface in the same release.
 *
 * Sync is ALWAYS user-initiated (the spec is explicit). Never
 * fires automatically.
 */

import {ApiError} from "../api/client";
import {getDb} from "./db";
import type {ImportedConversation} from "../types/domain";

// ----- Persistence ----------------------------------------------------

const KEY_CONFIG = "adaptive-learner.sync.config";
const KEY_LAST_SYNC = "adaptive-learner.sync.last_sync_at";
const KEY_HISTORY = "adaptive-learner.sync.history";

export interface SyncConfig {
    /** Backend host (IP or hostname). */
    host: string;
    /** Backend port (default 18001). */
    port: number;
    /** The paired user_id; both devices share this after pair. */
    user_id: string;
    /** Cached display name for the Settings UI. */
    user_name: string;
    /** When pairing succeeded (ISO 8601). */
    paired_at: string;
    /** Optional friendly device label the user assigned. */
    device_name?: string;
}

export interface SyncHistoryEntry {
    at: string;
    success: boolean;
    pushed: number;
    pulled: number;
    conflicts: number;
    summary: string;
}

export function readSyncConfig(): SyncConfig | null {
    try {
        const raw = localStorage.getItem(KEY_CONFIG);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (
            parsed &&
            typeof parsed === "object" &&
            typeof parsed.host === "string" &&
            typeof parsed.port === "number" &&
            typeof parsed.user_id === "string"
        ) {
            return parsed as SyncConfig;
        }
        return null;
    } catch {
        return null;
    }
}

export function writeSyncConfig(config: SyncConfig | null): void {
    try {
        if (config === null) {
            localStorage.removeItem(KEY_CONFIG);
        } else {
            localStorage.setItem(KEY_CONFIG, JSON.stringify(config));
        }
    } catch {
        /* no-op; localStorage unavailable */
    }
}

export function readLastSyncAt(): string | null {
    try {
        return localStorage.getItem(KEY_LAST_SYNC);
    } catch {
        return null;
    }
}

export function writeLastSyncAt(iso: string | null): void {
    try {
        if (iso === null) {
            localStorage.removeItem(KEY_LAST_SYNC);
        } else {
            localStorage.setItem(KEY_LAST_SYNC, iso);
        }
    } catch {
        /* no-op */
    }
}

export function readSyncHistory(): SyncHistoryEntry[] {
    try {
        const raw = localStorage.getItem(KEY_HISTORY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as SyncHistoryEntry[]) : [];
    } catch {
        return [];
    }
}

export function appendSyncHistory(entry: SyncHistoryEntry): void {
    const history = readSyncHistory();
    history.unshift(entry);
    const trimmed = history.slice(0, 5);
    try {
        localStorage.setItem(KEY_HISTORY, JSON.stringify(trimmed));
    } catch {
        /* no-op */
    }
}

// ----- Pairing URI ----------------------------------------------------

/**
 * Pairing URI shape: ``adaptive-learner://sync?host=192.168.1.x&port=18001&token=abc``.
 * Embedded in the QR code on the desktop, parsed on the phone.
 */
export interface PairingPayload {
    host: string;
    port: number;
    token: string;
}

export function buildPairingUri(payload: PairingPayload): string {
    const params = new URLSearchParams({
        host: payload.host,
        port: String(payload.port),
        token: payload.token,
    });
    return `adaptive-learner://sync?${params.toString()}`;
}

export function parsePairingUri(uri: string): PairingPayload | null {
    if (typeof uri !== "string" || uri.trim() === "") return null;
    const trimmed = uri.trim();
    let qs: string;
    if (trimmed.startsWith("adaptive-learner://sync?")) {
        qs = trimmed.slice("adaptive-learner://sync?".length);
    } else if (trimmed.startsWith("?")) {
        qs = trimmed.slice(1);
    } else if (trimmed.includes("?")) {
        qs = trimmed.split("?")[1] ?? "";
    } else {
        return null;
    }
    const params = new URLSearchParams(qs);
    const host = params.get("host")?.trim();
    const portRaw = params.get("port")?.trim();
    const token = params.get("token")?.trim();
    if (!host || !portRaw || !token) return null;
    const port = parseInt(portRaw, 10);
    if (!Number.isFinite(port) || port <= 0 || port > 65535) return null;
    return {host, port, token};
}

// ----- Table sync metadata --------------------------------------------

interface SyncTable {
    name: string;
    dexieTable: keyof ReturnType<typeof getDb>;
    timestampField: string;
    appendOnly: boolean;
}

/**
 * Tables we sync, in dependency order. Parent rows ship before
 * children so the receiving side never has a dangling FK.
 */
const SYNC_TABLES: SyncTable[] = [
    {name: "users", dexieTable: "users", timestampField: "updated_at", appendOnly: false},
    {
        name: "user_settings",
        dexieTable: "userSettings",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        name: "learning_projects",
        dexieTable: "learningProjects",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        name: "learning_profiles",
        dexieTable: "learningProfiles",
        timestampField: "assessed_at",
        appendOnly: false,
    },
    {name: "curriculums", dexieTable: "curricula", timestampField: "updated_at", appendOnly: false},
    {
        name: "learning_topics",
        dexieTable: "learningTopics",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {name: "lessons", dexieTable: "lessons", timestampField: "updated_at", appendOnly: false},
    // Append-only:
    {
        name: "learning_sessions",
        dexieTable: "learningSessions",
        timestampField: "started_at",
        appendOnly: true,
    },
    {
        name: "session_messages",
        dexieTable: "sessionMessages",
        timestampField: "created_at",
        appendOnly: true,
    },
    {
        name: "session_ratings",
        dexieTable: "sessionRatings",
        timestampField: "created_at",
        appendOnly: true,
    },
    {
        // v1.8.0 / Phase 21B — promoted to MUTABLE. Notes are
        // user-editable in the UI; the conflict-resolution
        // pipeline picks a winner by ``updated_at``. The
        // backend Alembic migration 0006 + the Dexie v4 schema
        // upgrade back-fill ``updated_at = created_at`` for
        // historical rows.
        name: "session_notes",
        dexieTable: "sessionNotes",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        name: "progress_commits",
        dexieTable: "progressCommits",
        timestampField: "committed_at",
        appendOnly: true,
    },
    {
        name: "method_switches",
        dexieTable: "methodSwitches",
        timestampField: "switched_at",
        appendOnly: true,
    },
    {
        // v1.8.0 / Phase 21A — aligned with backend column names
        // (``to_step`` + ``evaluated_at``) via the Dexie v3
        // schema upgrade. Append-only: an evaluation row is the
        // verdict at the moment of evaluation; later edits would
        // misrepresent history.
        name: "step_evaluations",
        dexieTable: "stepEvaluations",
        timestampField: "evaluated_at",
        appendOnly: true,
    },
    {
        // v1.8.0 / Phase 21D — chat-history surface joins sync.
        // APPEND-ONLY: ``analyzed`` + ``analysis_result`` are NOT
        // updated post-sync; each device runs its own analysis
        // (the AI roundtrip is expensive and per-device).
        name: "imported_conversations",
        dexieTable: "importedConversations",
        timestampField: "imported_at",
        appendOnly: true,
    },
    {
        // v1.8.0 / Phase 21D — paired with imported_conversations.
        // ``created_at`` added via Dexie v5 + Alembic 0007.
        name: "imported_messages",
        dexieTable: "importedMessages",
        timestampField: "created_at",
        appendOnly: true,
    },
    {
        // v1.9.0 / Phase 22A — Subjects (global taxonomy) +
        // Tags (per-user labels). Subjects are MUTABLE (rename /
        // re-parent / icon edit). Tags are MUTABLE too (rename /
        // color edit).
        name: "subjects",
        dexieTable: "subjects",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        name: "tags",
        dexieTable: "tags",
        timestampField: "created_at",
        appendOnly: false,
    },
    {
        // M:N association rows are APPEND-ONLY: assigning /
        // unassigning is an insert / delete, never an update.
        name: "project_subjects",
        dexieTable: "projectSubjects",
        timestampField: "created_at",
        appendOnly: true,
    },
    {
        name: "project_tags",
        dexieTable: "projectTags",
        timestampField: "created_at",
        appendOnly: true,
    },
    {
        // v1.16.0 / Phase 29A — per-user XP / level singleton.
        // MUTABLE: ``total_xp`` advances on every session-end,
        // assessment, import. Conflict resolution by
        // ``updated_at`` picks the device that accumulated more
        // recently (the user's true cross-device total can drift
        // briefly during offline use; the last-write wins is
        // intentional — exact cross-device merging of XP isn't
        // useful and rewards the wrong behaviour).
        name: "user_xp",
        dexieTable: "userXp",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        // v1.16.0 / Phase 29B — badge catalog (global, MUTABLE).
        // The seed YAML is the source of truth; sync carries the
        // catalog so a fresh device knows about every available
        // badge before the user earns any.
        name: "badges",
        dexieTable: "badges",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        // v1.16.0 / Phase 29B — earned-badge record. APPEND-ONLY:
        // earning is an insert; un-earning isn't supported.
        name: "user_badges",
        dexieTable: "userBadges",
        timestampField: "earned_at",
        appendOnly: true,
    },
    {
        // v1.16.0 / Phase 29C — per-user streak state singleton.
        // MUTABLE: freezes earned / spent + weekend-mode flag.
        name: "user_streaks",
        dexieTable: "userStreaks",
        timestampField: "updated_at",
        appendOnly: false,
    },
];

const APPEND_ONLY_TABLES = new Set(
    SYNC_TABLES.filter((t) => t.appendOnly).map((t) => t.name),
);

// ----- Conflict + resolution shapes -----------------------------------

export interface ConflictBundle {
    table: string;
    id: string;
    local: Record<string, unknown>;
    remote: Record<string, unknown>;
}

export type ConflictChoice = "local" | "remote" | "merged";

export interface ConflictResolution {
    table: string;
    id: string;
    chosen: ConflictChoice;
    merged_data?: Record<string, unknown>;
}

export interface SyncOutcome {
    pushed: number;
    pulled: number;
    conflictsResolved: number;
    summary: string;
}

/**
 * Optional callback the UI hooks in to resolve conflicts. The
 * SyncEngine fires it AFTER push reveals conflicts and BEFORE
 * the final resolve+pull. The callback returns one decision per
 * conflict.
 */
export type ConflictResolver = (
    conflicts: ConflictBundle[],
) => Promise<ConflictResolution[]>;

// ----- Engine ----------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 8000;

export interface SyncEngineDeps {
    /** Override fetch (tests). */
    fetch?: typeof globalThis.fetch;
    /** Override clock (tests). */
    now?: () => Date;
}

export class SyncEngine {
    private readonly _fetch: typeof globalThis.fetch;
    private readonly _now: () => Date;
    private inFlight = false;

    constructor(deps: SyncEngineDeps = {}) {
        this._fetch = deps.fetch ?? globalThis.fetch.bind(globalThis);
        this._now = deps.now ?? (() => new Date());
    }

    /** Persist the active pairing config. */
    getConfig(): SyncConfig | null {
        return readSyncConfig();
    }

    /**
     * Pair this device to a backend using the URI from the
     * desktop's QR. Verifies the token, persists the config.
     *
     * Throws ``ApiError`` on bad URI, network error, or token
     * rejection.
     */
    async pair(uri: string, deviceName?: string): Promise<SyncConfig> {
        const payload = parsePairingUri(uri);
        if (payload === null) {
            throw new ApiError(400, "Invalid pairing link.", "/sync/pair", "POST");
        }
        const verifyUrl = `http://${payload.host}:${payload.port}/api/sync/pair/verify`;
        const response = await this._fetchJson<{
            user_id: string;
            user: {id: string; name: string};
        }>("POST", verifyUrl, {token: payload.token});
        const config: SyncConfig = {
            host: payload.host,
            port: payload.port,
            user_id: response.user_id,
            user_name: response.user.name,
            paired_at: this._now().toISOString(),
            device_name: deviceName,
        };
        writeSyncConfig(config);
        writeLastSyncAt(null);
        return config;
    }

    /** Drop the active pairing. Does not delete local data. */
    unpair(): void {
        writeSyncConfig(null);
        writeLastSyncAt(null);
        try {
            localStorage.removeItem(KEY_HISTORY);
        } catch {
            /* no-op */
        }
    }

    /**
     * Probe the remote backend's reachability. Returns true on
     * 2xx, false on any failure. Settings panel uses this for
     * the "Reachable: yes/no" indicator.
     */
    async ping(): Promise<boolean> {
        const config = this.getConfig();
        if (!config) return false;
        const url = `http://${config.host}:${config.port}/api/health`;
        try {
            const response = await this._fetchWithTimeout(url, {
                method: "GET",
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Full bidirectional sync. The flow:
     *
     *   1. PUSH every changed local row per table.
     *   2. If push surfaces conflicts and a resolver is given,
     *      invoke it and POST /sync/resolve with the answers.
     *      If no resolver: skip the conflicted rows (next sync
     *      retries).
     *   3. PULL every row newer than ``last_sync_at`` from the
     *      remote, apply to Dexie.
     *   4. Stamp ``last_sync_at`` to the server's response time.
     *
     * Pushes BEFORE pulls so the server has the latest local
     * data when computing what to send back. The classic "last
     * writer wins for new rows, conflict for both-modified" shape.
     */
    async sync(resolver?: ConflictResolver): Promise<SyncOutcome> {
        const config = this.getConfig();
        if (!config) {
            throw new ApiError(409, "Device is not paired.", "/sync", "POST");
        }
        if (this.inFlight) {
            throw new ApiError(409, "Sync already in progress.", "/sync", "POST");
        }
        this.inFlight = true;
        const startedAt = this._now().toISOString();
        const since = readLastSyncAt();
        let pushed = 0;
        let pulled = 0;
        let conflictsResolved = 0;
        const accumulatedConflicts: ConflictBundle[] = [];
        try {
            // --- PUSH ---
            for (const table of SYNC_TABLES) {
                const localRows = await this._readLocalSince(table, since);
                if (localRows.length === 0) continue;
                const response = await this._push(
                    config,
                    table.name,
                    localRows,
                    since,
                );
                pushed += response.accepted.length;
                if (response.conflicts.length > 0) {
                    accumulatedConflicts.push(...response.conflicts);
                }
            }

            // --- RESOLVE ---
            if (accumulatedConflicts.length > 0 && resolver) {
                const decisions = await resolver(accumulatedConflicts);
                if (decisions.length > 0) {
                    await this._postJson(config, "/api/sync/resolve", {
                        user_id: config.user_id,
                        resolutions: decisions.map((d) => ({
                            table: d.table,
                            id: d.id,
                            chosen: d.chosen,
                            merged_data: d.merged_data,
                        })),
                    });
                    conflictsResolved = decisions.length;
                    // Apply local-side: for "remote" / "merged"
                    // we'll let the PULL phase bring back the
                    // server-truth row. For "local" we keep
                    // local — no-op.
                }
            }

            // --- PULL ---
            const pullResponse = await this._pull(config, since);
            for (const table of SYNC_TABLES) {
                const remoteRows = pullResponse.records[table.name] ?? [];
                if (remoteRows.length === 0) continue;
                pulled += await this._applyPulledRows(table, remoteRows);
            }

            // --- STAMP ---
            const newSyncAt = this._now().toISOString();
            writeLastSyncAt(newSyncAt);

            const summary = this._formatSummary(
                pushed,
                pulled,
                accumulatedConflicts.length,
                conflictsResolved,
            );
            appendSyncHistory({
                at: startedAt,
                success: true,
                pushed,
                pulled,
                conflicts: accumulatedConflicts.length,
                summary,
            });
            return {
                pushed,
                pulled,
                conflictsResolved,
                summary,
            };
        } catch (err) {
            const summary =
                err instanceof ApiError
                    ? err.detail
                    : err instanceof Error
                      ? err.message
                      : "Sync failed.";
            appendSyncHistory({
                at: startedAt,
                success: false,
                pushed,
                pulled,
                conflicts: accumulatedConflicts.length,
                summary,
            });
            throw err;
        } finally {
            this.inFlight = false;
        }
    }

    // ---- Internals ---------------------------------------------------

    private async _readLocalSince(
        table: SyncTable,
        since: string | null,
    ): Promise<Record<string, unknown>[]> {
        const db = getDb() as unknown as Record<string, {toArray(): Promise<unknown[]>}>;
        const tableHandle = db[table.dexieTable as string];
        if (!tableHandle || typeof tableHandle.toArray !== "function") {
            return [];
        }
        const all = (await tableHandle.toArray()) as Record<string, unknown>[];
        if (since === null) return all;
        return all.filter((row) => {
            const ts = row[table.timestampField];
            if (typeof ts !== "string") return true;
            return ts > since;
        });
    }

    private async _push(
        config: SyncConfig,
        tableName: string,
        records: Record<string, unknown>[],
        since: string | null,
    ): Promise<{
        accepted: string[];
        conflicts: ConflictBundle[];
        skipped: string[];
    }> {
        const response = await this._postJson<{
            accepted: string[];
            conflicts: ConflictBundle[];
            skipped: string[];
        }>(config, "/api/sync/push", {
            user_id: config.user_id,
            table: tableName,
            records,
            since,
        });
        return response;
    }

    private async _pull(
        config: SyncConfig,
        since: string | null,
    ): Promise<{records: Record<string, Record<string, unknown>[]>}> {
        return this._postJson<{
            records: Record<string, Record<string, unknown>[]>;
        }>(config, "/api/sync/pull", {
            user_id: config.user_id,
            tables: SYNC_TABLES.map((t) => t.name),
            since,
        });
    }

    private async _applyPulledRows(
        table: SyncTable,
        rows: Record<string, unknown>[],
    ): Promise<number> {
        const db = getDb() as unknown as Record<
            string,
            {put(row: unknown): Promise<unknown>; get(id: string): Promise<unknown>}
        >;
        const handle = db[table.dexieTable as string];
        if (!handle || typeof handle.put !== "function") return 0;
        let applied = 0;
        for (const row of rows) {
            if (table.appendOnly) {
                const id = row.id as string | undefined;
                if (!id) continue;
                const existing = await handle.get(id);
                if (existing) continue; // idempotent skip
            }
            await handle.put(row);
            applied += 1;
        }
        return applied;
    }

    private async _postJson<T>(
        config: SyncConfig,
        path: string,
        body: unknown,
    ): Promise<T> {
        const url = `http://${config.host}:${config.port}${path}`;
        return this._fetchJson<T>("POST", url, body);
    }

    private async _fetchJson<T>(
        method: string,
        url: string,
        body: unknown,
    ): Promise<T> {
        const response = await this._fetchWithTimeout(url, {
            method,
            headers: {"Content-Type": "application/json"},
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!response.ok) {
            let detail = `HTTP ${response.status}`;
            try {
                const errBody = await response.json();
                if (typeof errBody?.detail === "string") detail = errBody.detail;
            } catch {
                /* ignore */
            }
            throw new ApiError(response.status, detail, url, method);
        }
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
    }

    private async _fetchWithTimeout(
        url: string,
        init: RequestInit,
        timeoutMs = DEFAULT_TIMEOUT_MS,
    ): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await this._fetch(url, {...init, signal: controller.signal});
        } finally {
            clearTimeout(timer);
        }
    }

    private _formatSummary(
        pushed: number,
        pulled: number,
        totalConflicts: number,
        resolved: number,
    ): string {
        const parts: string[] = [];
        if (pushed > 0) parts.push(`pushed ${pushed}`);
        if (pulled > 0) parts.push(`pulled ${pulled}`);
        if (resolved > 0) parts.push(`resolved ${resolved} conflict(s)`);
        if (totalConflicts > resolved) {
            parts.push(`${totalConflicts - resolved} conflict(s) deferred`);
        }
        if (parts.length === 0) return "Already in sync.";
        return parts.join(", ") + ".";
    }
}

// ---- Singleton (test-resetable) -------------------------------------

let _engine: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine {
    if (_engine === null) _engine = new SyncEngine();
    return _engine;
}

export function _resetSyncEngineForTests(deps?: SyncEngineDeps): SyncEngine {
    _engine = new SyncEngine(deps);
    return _engine;
}

// Re-export for any UI module that needs to inspect the table list.
export {SYNC_TABLES, APPEND_ONLY_TABLES};

// Keep the ``ImportedConversation`` import alive so future v1.1
// can sync these rows without churning the import surface.
export type _SyncReservedFutureTypes = ImportedConversation;
