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
 *
 * Split (#1795): this file keeps the engine + singleton and is the
 * stable import hub; persistence, the pairing URI, the table
 * metadata, and the conflict/outcome contracts live in the sibling
 * sync-* modules.
 */

import {ApiError} from "../../api/client";
import {getDb} from "../dexie/db";
import type {ImportedConversation} from "../../types/domain";
import {
    readLastSyncAt,
    readSyncConfig,
    writeLastSyncAt,
    writeSyncConfig,
    appendSyncHistory,
    clearSyncHistory,
    type SyncConfig,
} from "./sync-persistence";
import {parsePairingUri} from "./sync-pairing";
import {SYNC_TABLES, type SyncTable} from "./sync-tables";
import type {
    ConflictBundle,
    ConflictResolver,
    SyncOutcome,
} from "./sync-types";

export {
    readLastSyncAt,
    readSyncConfig,
    readSyncHistory,
    writeLastSyncAt,
    writeSyncConfig,
    appendSyncHistory,
    clearSyncHistory,
    type SyncConfig,
    type SyncHistoryEntry,
} from "./sync-persistence";
export {
    buildPairingUri,
    parsePairingUri,
    type PairingPayload,
} from "./sync-pairing";
export {SYNC_TABLES, APPEND_ONLY_TABLES} from "./sync-tables";
export type {
    ConflictBundle,
    ConflictChoice,
    ConflictResolution,
    ConflictResolver,
    SyncOutcome,
} from "./sync-types";

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
        clearSyncHistory();
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

// Keep the ``ImportedConversation`` import alive so future v1.1
// can sync these rows without churning the import surface.
export type _SyncReservedFutureTypes = ImportedConversation;
