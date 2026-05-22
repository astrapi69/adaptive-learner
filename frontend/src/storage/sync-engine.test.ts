/**
 * Sync engine tests (Phase 13C).
 *
 * Uses fake-indexeddb for the Dexie side and a hand-rolled fetch
 * mock for the network calls. Each test resets both stores +
 * localStorage so no state leaks.
 */

import "fake-indexeddb/auto";

import {beforeEach, describe, expect, it, vi} from "vitest";

import {
    SYNC_TABLES,
    SyncEngine,
    appendSyncHistory,
    buildPairingUri,
    parsePairingUri,
    readSyncConfig,
    readSyncHistory,
    readLastSyncAt,
    writeSyncConfig,
    writeLastSyncAt,
    type ConflictBundle,
    type ConflictResolution,
} from "./sync-engine";
import {_resetDbForTests, getDb} from "./db";

beforeEach(async () => {
    await _resetDbForTests();
    localStorage.clear();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
    // Explicit per-table clear: the IDBFactory swap above doesn't
    // always invalidate Dexie's reuse of the previous backing
    // store under happy-dom + fake-indexeddb. Clearing each table
    // is the safest reset across tests.
    const db = getDb();
    await Promise.all([
        db.users.clear(),
        db.userSettings.clear(),
        db.learningProjects.clear(),
        db.learningProfiles.clear(),
        db.curricula.clear(),
        db.learningTopics.clear(),
        db.lessons.clear(),
        db.learningSessions.clear(),
        db.sessionMessages.clear(),
        db.sessionRatings.clear(),
        db.sessionNotes.clear(),
        db.progressCommits.clear(),
        db.methodSwitches.clear(),
        db.stepEvaluations.clear(),
    ]);
});

// ----- URI helpers ----------------------------------------------------

describe("buildPairingUri / parsePairingUri", () => {
    it("round-trips a payload", () => {
        const payload = {host: "192.168.1.10", port: 18001, token: "deadbeef"};
        const uri = buildPairingUri(payload);
        expect(uri).toContain("adaptive-learner://sync");
        expect(uri).toContain("host=192.168.1.10");
        expect(uri).toContain("port=18001");
        expect(uri).toContain("token=deadbeef");
        const parsed = parsePairingUri(uri);
        expect(parsed).toEqual(payload);
    });

    it("rejects an empty string", () => {
        expect(parsePairingUri("")).toBeNull();
        expect(parsePairingUri("   ")).toBeNull();
    });

    it("rejects a malformed URI", () => {
        expect(parsePairingUri("not a uri")).toBeNull();
    });

    it("rejects a URI missing required params", () => {
        expect(
            parsePairingUri("adaptive-learner://sync?host=x&port=18001"),
        ).toBeNull();
        expect(
            parsePairingUri("adaptive-learner://sync?token=x"),
        ).toBeNull();
    });

    it("rejects an invalid port", () => {
        expect(
            parsePairingUri(
                "adaptive-learner://sync?host=x&port=abc&token=t",
            ),
        ).toBeNull();
        expect(
            parsePairingUri(
                "adaptive-learner://sync?host=x&port=999999&token=t",
            ),
        ).toBeNull();
    });

    it("accepts a bare query string", () => {
        const parsed = parsePairingUri("?host=x&port=18001&token=t");
        expect(parsed).toEqual({host: "x", port: 18001, token: "t"});
    });
});

// ----- Persistence helpers --------------------------------------------

describe("config + last-sync + history persistence", () => {
    it("writes and reads a SyncConfig", () => {
        const cfg = {
            host: "x",
            port: 18001,
            user_id: "u1",
            user_name: "Aster",
            paired_at: "2026-05-20T10:00:00.000Z",
        };
        writeSyncConfig(cfg);
        expect(readSyncConfig()).toEqual(cfg);
    });

    it("returns null when nothing is persisted", () => {
        expect(readSyncConfig()).toBeNull();
        expect(readLastSyncAt()).toBeNull();
    });

    it("appends sync history, trimmed to 5 entries", () => {
        for (let i = 0; i < 7; i++) {
            appendSyncHistory({
                at: `2026-05-20T10:0${i}:00Z`,
                success: true,
                pushed: 1,
                pulled: 0,
                conflicts: 0,
                summary: `run ${i}`,
            });
        }
        const history = readSyncHistory();
        expect(history.length).toBe(5);
        // Newest first; we appended 0..6 → last 5 are runs 6,5,4,3,2.
        expect(history[0].summary).toBe("run 6");
    });

    it("clears persistence on a null config", () => {
        writeSyncConfig({
            host: "x",
            port: 1,
            user_id: "u",
            user_name: "n",
            paired_at: "z",
        });
        writeSyncConfig(null);
        expect(readSyncConfig()).toBeNull();
    });
});

// ----- Engine ---------------------------------------------------------

function makeMockFetch(
    routes: Record<string, (body: unknown) => unknown>,
): typeof globalThis.fetch {
    return (async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        const handler = routes[path] ?? routes[url];
        if (!handler) {
            return new Response(JSON.stringify({detail: `No route: ${path}`}), {
                status: 404,
                headers: {"content-type": "application/json"},
            });
        }
        const body = init?.body ? JSON.parse(init.body as string) : null;
        const result = handler(body);
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: {"content-type": "application/json"},
        });
    }) as typeof globalThis.fetch;
}

describe("SyncEngine.pair", () => {
    it("verifies the token and persists the config", async () => {
        const fetch = makeMockFetch({
            "/api/sync/pair/verify": () => ({
                user_id: "u-aster",
                user: {
                    id: "u-aster",
                    name: "Aster",
                    email: null,
                    language: "en",
                    created_at: "2026-01-01T00:00:00Z",
                    updated_at: "2026-01-01T00:00:00Z",
                },
            }),
        });
        const engine = new SyncEngine({fetch});
        const uri =
            "adaptive-learner://sync?host=192.168.1.10&port=18001&token=tok";
        const config = await engine.pair(uri, "Phone");
        expect(config.user_id).toBe("u-aster");
        expect(config.host).toBe("192.168.1.10");
        expect(config.user_name).toBe("Aster");
        expect(readSyncConfig()).toEqual(config);
    });

    it("rejects an invalid URI", async () => {
        const engine = new SyncEngine({fetch: vi.fn()});
        await expect(engine.pair("not a uri")).rejects.toMatchObject({
            status: 400,
        });
    });

    it("propagates a 404 from the backend", async () => {
        const fetch = (async () =>
            new Response(JSON.stringify({detail: "expired"}), {
                status: 404,
            })) as typeof globalThis.fetch;
        const engine = new SyncEngine({fetch});
        await expect(
            engine.pair(
                "adaptive-learner://sync?host=x&port=18001&token=expired",
            ),
        ).rejects.toMatchObject({status: 404});
    });
});

describe("SyncEngine.unpair", () => {
    it("clears the config + last-sync + history", () => {
        writeSyncConfig({
            host: "x",
            port: 1,
            user_id: "u",
            user_name: "n",
            paired_at: "z",
        });
        writeLastSyncAt("2026-01-01T00:00:00Z");
        appendSyncHistory({
            at: "2026-01-01T00:00:00Z",
            success: true,
            pushed: 1,
            pulled: 0,
            conflicts: 0,
            summary: "x",
        });
        new SyncEngine().unpair();
        expect(readSyncConfig()).toBeNull();
        expect(readLastSyncAt()).toBeNull();
        expect(readSyncHistory()).toEqual([]);
    });
});

describe("SyncEngine.ping", () => {
    it("returns true on a 2xx", async () => {
        writeSyncConfig({
            host: "h",
            port: 1,
            user_id: "u",
            user_name: "n",
            paired_at: "z",
        });
        const fetch = (async () =>
            new Response("{}", {status: 200})) as typeof globalThis.fetch;
        expect(await new SyncEngine({fetch}).ping()).toBe(true);
    });

    it("returns false when no config exists", async () => {
        expect(await new SyncEngine().ping()).toBe(false);
    });

    it("returns false on network failure", async () => {
        writeSyncConfig({
            host: "h",
            port: 1,
            user_id: "u",
            user_name: "n",
            paired_at: "z",
        });
        const fetch = (async () => {
            throw new Error("network");
        }) as typeof globalThis.fetch;
        expect(await new SyncEngine({fetch}).ping()).toBe(false);
    });
});

describe("SyncEngine.sync", () => {
    function setupConfig() {
        writeSyncConfig({
            host: "h",
            port: 1,
            user_id: "u-aster",
            user_name: "Aster",
            paired_at: "2026-01-01T00:00:00Z",
        });
    }

    it("throws if not paired", async () => {
        await expect(new SyncEngine().sync()).rejects.toMatchObject({
            status: 409,
        });
    });

    it("pushes local rows + pulls remote rows", async () => {
        setupConfig();
        // Seed a local user row that should push.
        const db = getDb();
        await db.users.put({
            id: "u-aster",
            name: "Aster",
            email: null,
            language: "en",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
        });
        const pushedTables: Record<string, unknown[]> = {};
        const fetch = makeMockFetch({
            "/api/sync/push": (body: unknown) => {
                const b = body as {table: string; records: unknown[]};
                pushedTables[b.table] = b.records;
                return {accepted: ["u-aster"], conflicts: [], skipped: []};
            },
            "/api/sync/pull": () => ({
                records: {
                    learning_projects: [
                        {
                            id: "p-1",
                            user_id: "u-aster",
                            topic: "Bayes",
                            goal: "ship",
                            timeframe: "1w",
                            daily_minutes: 30,
                            current_problem: null,
                            active: true,
                            created_at: "2026-05-20T10:00:00.000Z",
                            updated_at: "2026-05-20T10:00:00.000Z",
                        },
                    ],
                },
            }),
        });
        const engine = new SyncEngine({fetch});
        const outcome = await engine.sync();
        expect(outcome.pushed).toBeGreaterThan(0);
        expect(outcome.pulled).toBe(1);
        expect(pushedTables.users).toBeDefined();
        const stored = await db.learningProjects.get("p-1");
        expect(stored?.topic).toBe("Bayes");
        // Last-sync stamp is set.
        expect(readLastSyncAt()).not.toBeNull();
    });

    it("invokes the resolver when push returns conflicts", async () => {
        setupConfig();
        const db = getDb();
        await db.users.put({
            id: "u-aster",
            name: "Aster (local)",
            email: null,
            language: "en",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-05-20T11:00:00.000Z",
        });
        let resolveBody: unknown = null;
        const fetch = makeMockFetch({
            "/api/sync/push": (body: unknown) => {
                const b = body as {table: string};
                if (b.table === "users") {
                    return {
                        accepted: [],
                        conflicts: [
                            {
                                table: "users",
                                id: "u-aster",
                                local: {name: "Aster (local)"},
                                remote: {name: "Aster (remote)"},
                            },
                        ],
                        skipped: [],
                    };
                }
                return {accepted: [], conflicts: [], skipped: []};
            },
            "/api/sync/resolve": (body: unknown) => {
                resolveBody = body;
                return {applied: ["u-aster"], skipped: []};
            },
            "/api/sync/pull": () => ({records: {}}),
        });
        const resolver = vi.fn(
            async (conflicts: ConflictBundle[]): Promise<ConflictResolution[]> => {
                expect(conflicts.length).toBe(1);
                return conflicts.map((c) => ({
                    table: c.table,
                    id: c.id,
                    chosen: "local" as const,
                }));
            },
        );
        const engine = new SyncEngine({fetch});
        const outcome = await engine.sync(resolver);
        expect(resolver).toHaveBeenCalled();
        expect(outcome.conflictsResolved).toBe(1);
        expect(resolveBody).not.toBeNull();
    });

    it("skips conflicts when no resolver is provided", async () => {
        setupConfig();
        const db = getDb();
        await db.users.put({
            id: "u-aster",
            name: "Aster (local)",
            email: null,
            language: "en",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-05-20T11:00:00.000Z",
        });
        const pushedTablesList: string[] = [];
        const fetch = makeMockFetch({
            "/api/sync/push": (body: unknown) => {
                const b = body as {table: string};
                pushedTablesList.push(b.table);
                if (b.table === "users") {
                    return {
                        accepted: [],
                        conflicts: [
                            {
                                table: "users",
                                id: "u-aster",
                                local: {},
                                remote: {},
                            },
                        ],
                        skipped: [],
                    };
                }
                return {accepted: [], conflicts: [], skipped: []};
            },
            "/api/sync/pull": () => ({records: {}}),
        });
        const engine = new SyncEngine({fetch});
        const outcome = await engine.sync();
        expect(pushedTablesList).toEqual(["users"]);
        expect(outcome.conflictsResolved).toBe(0);
        // History records the deferred conflict.
        const history = readSyncHistory();
        expect(history[0]?.conflicts).toBe(1);
    });

    it("records a failed run in history", async () => {
        setupConfig();
        const fetch = (async () => {
            throw new Error("network down");
        }) as typeof globalThis.fetch;
        const engine = new SyncEngine({fetch});
        await expect(engine.sync()).rejects.toThrow();
        const history = readSyncHistory();
        expect(history[0]?.success).toBe(false);
    });

    it("rejects a concurrent sync call (in-flight gating)", async () => {
        setupConfig();
        const fetch = makeMockFetch({
            "/api/sync/pull": () => ({records: {}}),
        });
        const engine = new SyncEngine({fetch});
        // Synthetic in-flight: directly assert the engine's
        // internal gate fires when a sync is already running.
        // The actual ordering is: sync() sets inFlight = true
        // SYNCHRONOUSLY before its first ``await``, so a parallel
        // call from the same task sees the flag.
        (engine as unknown as {inFlight: boolean}).inFlight = true;
        await expect(engine.sync()).rejects.toMatchObject({status: 409});
        (engine as unknown as {inFlight: boolean}).inFlight = false;
    });

    // --- v1.8.0 / Phase 21A: step_evaluations in sync surface --

    it("pushes step_evaluations rows with the backend column names", async () => {
        setupConfig();
        const db = getDb();
        // Seed a session that scopes the evaluation row.
        await db.users.put({
            id: "u-aster",
            name: "A",
            email: null,
            language: "en",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
        });
        await db.learningProjects.put({
            id: "p-1",
            user_id: "u-aster",
            topic: "x",
            goal: "y",
            timeframe: "1w",
            daily_minutes: 30,
            current_problem: null,
            active: true,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
        });
        await db.learningSessions.put({
            id: "s-1",
            project_id: "p-1",
            method: "deductive",
            started_at: "2026-05-20T09:00:00.000Z",
            ended_at: null,
            cycle_step: 4,
            status: "active",
        });
        // The Dexie row uses the v1.8.0 column names directly.
        await db.stepEvaluations.put({
            id: "e-1",
            session_id: "s-1",
            from_step: 3,
            to_step: 4,
            advance: true,
            applied: true,
            confidence: 0.9,
            reason: "ok",
            fallback_used: false,
            duration_seconds: 60,
            evaluated_at: "2026-05-20T09:10:00.000Z",
        });

        const pushedRecords: Record<string, unknown[]> = {};
        const fetch = makeMockFetch({
            "/api/sync/push": (body: unknown) => {
                const b = body as {table: string; records: unknown[]};
                pushedRecords[b.table] = b.records;
                return {accepted: [], conflicts: [], skipped: []};
            },
            "/api/sync/pull": () => ({records: {}}),
        });
        const engine = new SyncEngine({fetch});
        await engine.sync();
        // step_evaluations ships with the same column names the
        // backend uses; the local-only ``duration_seconds`` is
        // dropped at the sync boundary by the (table-agnostic)
        // ``columns`` filter on the backend side.
        const evals = pushedRecords.step_evaluations as Array<
            Record<string, unknown>
        >;
        expect(evals).toBeDefined();
        expect(evals).toHaveLength(1);
        expect(evals[0]).toMatchObject({
            id: "e-1",
            session_id: "s-1",
            from_step: 3,
            to_step: 4,
            applied: true,
            evaluated_at: "2026-05-20T09:10:00.000Z",
        });
    });

    // --- v1.8.0 / Phase 21B: session_notes mutable sync --------

    it("pushes session_notes as MUTABLE rows with updated_at", async () => {
        setupConfig();
        const db = getDb();
        await db.users.put({
            id: "u-aster",
            name: "A",
            email: null,
            language: "en",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
        });
        await db.learningProjects.put({
            id: "p-1",
            user_id: "u-aster",
            topic: "x",
            goal: "y",
            timeframe: "1w",
            daily_minutes: 30,
            current_problem: null,
            active: true,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
        });
        await db.learningSessions.put({
            id: "s-1",
            project_id: "p-1",
            method: "deductive",
            started_at: "2026-05-20T09:00:00.000Z",
            ended_at: null,
            cycle_step: 1,
            status: "active",
        });
        await db.sessionNotes.put({
            id: "n-1",
            session_id: "s-1",
            content: "Initial note (local)",
            created_at: "2026-05-20T09:30:00.000Z",
            updated_at: "2026-05-20T09:45:00.000Z",
        });

        const pushedRecords: Record<string, unknown[]> = {};
        const fetch = makeMockFetch({
            "/api/sync/push": (body: unknown) => {
                const b = body as {table: string; records: unknown[]};
                pushedRecords[b.table] = b.records;
                return {accepted: [], conflicts: [], skipped: []};
            },
            "/api/sync/pull": () => ({records: {}}),
        });
        const engine = new SyncEngine({fetch});
        await engine.sync();
        const notes = pushedRecords.session_notes as Array<
            Record<string, unknown>
        >;
        expect(notes).toHaveLength(1);
        expect(notes[0]).toMatchObject({
            id: "n-1",
            content: "Initial note (local)",
            updated_at: "2026-05-20T09:45:00.000Z",
        });
    });

    it("invokes the conflict resolver when a session_notes push collides", async () => {
        setupConfig();
        const db = getDb();
        await db.users.put({
            id: "u-aster",
            name: "A",
            email: null,
            language: "en",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
        });
        await db.learningSessions.put({
            id: "s-1",
            project_id: "p-1",
            method: "deductive",
            started_at: "2026-05-20T09:00:00.000Z",
            ended_at: null,
            cycle_step: 1,
            status: "active",
        });
        await db.sessionNotes.put({
            id: "n-conflict",
            session_id: "s-1",
            content: "Edited locally",
            created_at: "2026-05-20T09:30:00.000Z",
            updated_at: "2026-05-20T11:00:00.000Z",
        });

        // Backend reports the note as a conflict — the remote
        // side has a newer revision. The resolver picks
        // "remote" so the local row is replaced on pull-back.
        const fetch = makeMockFetch({
            "/api/sync/push": (body: unknown) => {
                const b = body as {table: string};
                if (b.table === "session_notes") {
                    return {
                        accepted: [],
                        conflicts: [
                            {
                                table: "session_notes",
                                id: "n-conflict",
                                local: {
                                    id: "n-conflict",
                                    content: "Edited locally",
                                    updated_at: "2026-05-20T11:00:00.000Z",
                                },
                                remote: {
                                    id: "n-conflict",
                                    content: "Edited remotely",
                                    updated_at: "2026-05-20T11:30:00.000Z",
                                },
                            },
                        ],
                        skipped: [],
                    };
                }
                return {accepted: [], conflicts: [], skipped: []};
            },
            "/api/sync/resolve": () => ({accepted: 1, rejected: 0}),
            "/api/sync/pull": () => ({records: {}}),
        });
        const resolver = vi.fn(async (conflicts: ConflictBundle[]) => {
            // Pick the remote side (last-write-wins by timestamp).
            return conflicts.map((c) => ({
                table: c.table,
                id: c.id,
                chosen: "remote" as const,
            }));
        });
        const engine = new SyncEngine({fetch});
        const outcome = await engine.sync(resolver);
        expect(resolver).toHaveBeenCalledTimes(1);
        // The resolver saw the session_notes conflict.
        const bundles = resolver.mock.calls[0][0] as ConflictBundle[];
        expect(bundles[0].table).toBe("session_notes");
        expect(bundles[0].id).toBe("n-conflict");
        expect(outcome.conflictsResolved).toBe(1);
    });

    it("pulls step_evaluations and writes the Dexie row with the v1.8.0 column names", async () => {
        setupConfig();
        const db = getDb();
        await db.learningSessions.put({
            id: "s-remote",
            project_id: "p-r",
            method: "deductive",
            started_at: "2026-05-20T09:00:00.000Z",
            ended_at: null,
            cycle_step: 4,
            status: "active",
        });
        const fetch = makeMockFetch({
            "/api/sync/push": () => ({
                accepted: [],
                conflicts: [],
                skipped: [],
            }),
            "/api/sync/pull": () => ({
                records: {
                    step_evaluations: [
                        {
                            id: "e-remote",
                            session_id: "s-remote",
                            from_step: 3,
                            to_step: 4,
                            advance: true,
                            applied: true,
                            confidence: 0.92,
                            reason: "remote",
                            fallback_used: false,
                            evaluated_at: "2026-05-20T10:00:00.000Z",
                        },
                    ],
                },
            }),
        });
        const engine = new SyncEngine({fetch});
        await engine.sync();
        const stored = await db.stepEvaluations.get("e-remote");
        expect(stored).toBeDefined();
        expect(stored?.to_step).toBe(4);
        expect(stored?.evaluated_at).toBe("2026-05-20T10:00:00.000Z");
        // The backend doesn't ship ``duration_seconds`` so the
        // pulled row carries undefined for the Dexie-local
        // column; consumers default to 0 in their UI math.
    });

    // --- v1.8.0 / Phase 21D: imported_conversations + ---------
    // ---           imported_messages in sync surface ---------

    it("pushes imported_conversations + imported_messages to the backend", async () => {
        setupConfig();
        const db = getDb();
        await db.users.put({
            id: "u-aster",
            name: "A",
            email: null,
            language: "en",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
        });
        await db.importedConversations.put({
            id: "c-1",
            user_id: "u-aster",
            project_id: null,
            source: "chatgpt",
            title: "Test conversation",
            message_count: 2,
            imported_at: "2026-05-20T09:00:00.000Z",
            analyzed: false,
            analysis_result: null,
            topic_tag: null,
            model: null,
            source_created_at: null,
            content_hash: null,
        });
        await db.importedMessages.bulkPut([
            {
                id: "m-1",
                conversation_id: "c-1",
                role: "user",
                content: "Hello",
                timestamp: null,
                order_index: 0,
                created_at: "2026-05-20T09:00:00.000Z",
            },
            {
                id: "m-2",
                conversation_id: "c-1",
                role: "assistant",
                content: "Hi there",
                timestamp: null,
                order_index: 1,
                created_at: "2026-05-20T09:00:00.000Z",
            },
        ]);

        const pushedRecords: Record<string, unknown[]> = {};
        const fetch = makeMockFetch({
            "/api/sync/push": (body: unknown) => {
                const b = body as {table: string; records: unknown[]};
                pushedRecords[b.table] = b.records;
                return {accepted: [], conflicts: [], skipped: []};
            },
            "/api/sync/pull": () => ({records: {}}),
        });
        const engine = new SyncEngine({fetch});
        await engine.sync();

        const conversations = pushedRecords.imported_conversations as Array<
            Record<string, unknown>
        >;
        expect(conversations).toHaveLength(1);
        expect(conversations[0]).toMatchObject({
            id: "c-1",
            source: "chatgpt",
            title: "Test conversation",
            imported_at: "2026-05-20T09:00:00.000Z",
        });
        const messages = pushedRecords.imported_messages as Array<
            Record<string, unknown>
        >;
        expect(messages).toHaveLength(2);
        // Per-message created_at lets the backend filter on
        // "since last sync"; both messages share the parent's
        // imported_at because they were bulk-created.
        expect(messages[0]).toMatchObject({
            id: "m-1",
            conversation_id: "c-1",
            created_at: "2026-05-20T09:00:00.000Z",
        });
    });
});


// --- v1.8.0 / Phase 21E: frontend sync surface audit -----------------------


describe("SYNC_TABLES — surface audit", () => {
    /**
     * Pinned list of every Dexie table that domain code writes
     * to. If a new table is added to ``db.ts`` but not
     * ``SYNC_TABLES``, the test below fails and surfaces it as
     * a missing-from-sync hazard.
     *
     * Kept in this test file (not imported from db.ts) so the
     * canonical "is this table synced?" check has a hand-curated
     * audit list backing it — a code reviewer adding a Dexie
     * table has to touch BOTH places, which is the point.
     */
    const EXPECTED_TABLES = [
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
        // v1.9.0 / Phase 22A — Subjects + Tags taxonomy.
        "subjects",
        "tags",
        "project_subjects",
        "project_tags",
        // v1.16.0 / Phase 29A — gamification XP singleton.
        "user_xp",
        // v1.16.0 / Phase 29B — badge catalog + earned record.
        "badges",
        "user_badges",
        // v1.16.0 / Phase 29C — streak state singleton.
        "user_streaks",
        // v1.17.0 / Phase 30B — Anki flashcard suggestions.
        "anki_card_suggestions",
        // v1.19.0 / Phase 32B — Study questions.
        "study_questions",
    ];

    it("covers every domain Dexie table", () => {
        const actual = SYNC_TABLES.map((t) => t.name).sort();
        const expected = [...EXPECTED_TABLES].sort();
        expect(actual).toEqual(expected);
    });

    it("appendOnly classifications match the v1.9.0 spec", () => {
        const append = SYNC_TABLES.filter((t) => t.appendOnly)
            .map((t) => t.name)
            .sort();
        expect(append).toEqual(
            [
                "learning_sessions",
                "session_messages",
                "session_ratings",
                "progress_commits",
                "method_switches",
                "step_evaluations",
                "imported_conversations",
                "imported_messages",
                // v1.9.0 / Phase 22A — M:N association rows.
                "project_subjects",
                "project_tags",
                // v1.16.0 / Phase 29B — earned-badge record.
                "user_badges",
            ].sort(),
        );
    });

    it("every entry has a timestampField that the backend can filter on", () => {
        for (const t of SYNC_TABLES) {
            expect(t.timestampField).toBeTruthy();
            expect(typeof t.timestampField).toBe("string");
        }
    });
});
