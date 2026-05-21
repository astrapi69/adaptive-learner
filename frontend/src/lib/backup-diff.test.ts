/**
 * Backup diff engine tests (v1.12.0 / Phase 25A).
 *
 * Two backup payloads with known differences exercise every path
 * the renderer + Markdown exporter rely on:
 *   - added / removed detection by UUID
 *   - changed detection with field-level diff for mutable tables
 *   - append-only tables: no "changed" surfaced
 *   - unchanged counted but not enumerated
 *   - high-volume tables flagged for summary rendering
 *   - field blacklist (updated_at) doesn't pollute the diff
 *   - sort + filter helpers
 *   - chunked processing yields between chunks
 */

import {describe, expect, it, vi} from "vitest";

import type {BackupPayload} from "../types/domain";
import {
    APPEND_ONLY_TABLES,
    HIGH_VOLUME_TABLES,
    diffBackups,
    filterChangedTables,
    previewRow,
    sortTablesAlphabetically,
    sortTablesByDelta,
    __test__,
} from "./backup-diff";

function buildPayload(data: Record<string, Record<string, unknown>[]>): BackupPayload {
    return {
        format: "adaptive-learner-backup",
        version: "1.2.0",
        app_version: "1.12.0",
        created_at: "2026-05-18T12:00:00Z",
        user_id: "u-1",
        storage_mode: "dexie",
        data,
        stats: {
            total_records: Object.values(data).reduce((sum, rows) => sum + rows.length, 0),
            tables: {},
        },
    };
}

describe("diffBackups", () => {
    it("classifies added / removed / changed / unchanged for a mutable table", async () => {
        const a = buildPayload({
            learning_projects: [
                {
                    id: "p1",
                    topic: "Spanish",
                    daily_minutes: 30,
                    updated_at: "2026-05-10T00:00:00Z",
                },
                {
                    id: "p2",
                    topic: "Python",
                    daily_minutes: 60,
                    updated_at: "2026-05-10T00:00:00Z",
                },
                {
                    id: "p3",
                    topic: "French",
                    daily_minutes: 45,
                    updated_at: "2026-05-10T00:00:00Z",
                },
            ],
        });
        const b = buildPayload({
            learning_projects: [
                // p1 unchanged
                {
                    id: "p1",
                    topic: "Spanish",
                    daily_minutes: 30,
                    updated_at: "2026-05-10T00:00:00Z",
                },
                // p2 changed: daily_minutes 60 -> 45
                {
                    id: "p2",
                    topic: "Python",
                    daily_minutes: 45,
                    updated_at: "2026-05-18T00:00:00Z",
                },
                // p3 removed
                // p4 added
                {
                    id: "p4",
                    topic: "Italian",
                    daily_minutes: 20,
                    updated_at: "2026-05-18T00:00:00Z",
                },
            ],
        });
        const result = await diffBackups(a, b);
        const table = result.tables.find((t) => t.table === "learning_projects");
        expect(table).toBeDefined();
        expect(table!.added.map((r) => r.id)).toEqual(["p4"]);
        expect(table!.removed.map((r) => r.id)).toEqual(["p3"]);
        expect(table!.changed.map((r) => r.id)).toEqual(["p2"]);
        expect(table!.changed[0].fields.map((f) => f.field)).toEqual(["daily_minutes"]);
        expect(table!.changed[0].fields[0]).toEqual({
            field: "daily_minutes",
            old_value: 60,
            new_value: 45,
        });
        expect(table!.unchanged).toBe(1);
        expect(result.totals.added).toBe(1);
        expect(result.totals.removed).toBe(1);
        expect(result.totals.changed).toBe(1);
        expect(result.totals.unchanged).toBe(1);
    });

    it("never surfaces 'changed' for append-only tables", async () => {
        const oldRow = {
            id: "s1",
            method: "deductive",
            started_at: "2026-05-10T10:00:00Z",
            cycle_step: 4,
        };
        const a = buildPayload({learning_sessions: [oldRow]});
        // Same id, different mutable-looking fields. Append-only
        // contract treats the row as immutable history → unchanged.
        const b = buildPayload({
            learning_sessions: [{...oldRow, cycle_step: 7}],
        });
        const result = await diffBackups(a, b);
        const table = result.tables.find((t) => t.table === "learning_sessions")!;
        expect(table.append_only).toBe(true);
        expect(table.changed).toEqual([]);
        expect(table.unchanged).toBe(1);
    });

    it("flags high-volume tables", async () => {
        const a = buildPayload({
            session_messages: [
                {id: "m1", role: "user", content: "x", created_at: "2026-05-10T10:00:00Z"},
            ],
        });
        const b = buildPayload({session_messages: []});
        const result = await diffBackups(a, b);
        const table = result.tables.find((t) => t.table === "session_messages")!;
        expect(table.high_volume).toBe(true);
        expect(table.append_only).toBe(true);
        expect(table.removed.map((r) => r.id)).toEqual(["m1"]);
    });

    it("ignores blacklisted fields (updated_at) when detecting changes", async () => {
        const a = buildPayload({
            learning_projects: [
                {
                    id: "p1",
                    topic: "Spanish",
                    daily_minutes: 30,
                    updated_at: "2026-05-10T00:00:00Z",
                },
            ],
        });
        const b = buildPayload({
            learning_projects: [
                {
                    id: "p1",
                    topic: "Spanish",
                    daily_minutes: 30,
                    // Only updated_at differs — blacklisted.
                    updated_at: "2026-05-18T00:00:00Z",
                },
            ],
        });
        const result = await diffBackups(a, b);
        const table = result.tables.find((t) => t.table === "learning_projects")!;
        expect(table.changed).toEqual([]);
        expect(table.unchanged).toBe(1);
    });

    it("handles a table present only in B (added) and only in A (removed)", async () => {
        const a = buildPayload({
            tags: [{id: "t1", user_id: "u-1", name: "old-only"}],
        });
        const b = buildPayload({
            subjects: [{id: "s1", name: "new-only", parent_id: null}],
        });
        const result = await diffBackups(a, b);
        const tagsTable = result.tables.find((t) => t.table === "tags")!;
        const subjTable = result.tables.find((t) => t.table === "subjects")!;
        expect(tagsTable.removed.map((r) => r.id)).toEqual(["t1"]);
        expect(subjTable.added.map((r) => r.id)).toEqual(["s1"]);
    });

    it("includes the summary metadata from each backup", async () => {
        const a = buildPayload({});
        const b = buildPayload({});
        const result = await diffBackups(a, b);
        expect(result.backup_a.user_id).toBe("u-1");
        expect(result.backup_a.app_version).toBe("1.12.0");
        expect(result.backup_a.storage_mode).toBe("dexie");
        expect(result.backup_b.created_at).toBe("2026-05-18T12:00:00Z");
    });

    it("fires onProgress once per processed table", async () => {
        const a = buildPayload({learning_projects: [], tags: [], subjects: []});
        const b = buildPayload({learning_projects: [], tags: [], subjects: []});
        const events: Array<{table: string; completed: number; total: number}> = [];
        await diffBackups(a, b, {
            onProgress: (table, completed, total) => events.push({table, completed, total}),
        });
        expect(events.length).toBe(3);
        expect(events[0].total).toBe(3);
        expect(events[2].completed).toBe(3);
    });

    it("yields between chunks when processing many rows", async () => {
        // 5000 rows in a mutable table; chunk size 1000 → at least
        // 4 yields (5 chunks - we yield AFTER each chunk).
        const rows = Array.from({length: 5000}, (_, i) => ({
            id: `r${i}`,
            topic: `t${i}`,
            updated_at: "2026-05-10T00:00:00Z",
        }));
        const a = buildPayload({learning_projects: rows});
        const b = buildPayload({learning_projects: rows});
        const yieldSpy = vi.spyOn(globalThis, "setTimeout");
        const result = await diffBackups(a, b, {chunkSize: 1000});
        // setTimeout-based yield path fires once per chunk on
        // happy-dom (no requestIdleCallback).
        expect(yieldSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
        expect(result.totals.unchanged).toBe(5000);
        yieldSpy.mockRestore();
    });
});

describe("previewRow", () => {
    it("renders human-friendly one-liners per table", () => {
        expect(
            previewRow("learning_projects", {
                id: "p1",
                topic: "Spanish",
                daily_minutes: 45,
            }),
        ).toBe("Spanish (45 min/day)");
        expect(
            previewRow("learning_sessions", {
                id: "s1",
                method: "deductive",
                started_at: "2026-05-18T10:00:00Z",
                cycle_step: 4,
            }),
        ).toBe("2026-05-18 deductive (step 4)");
        expect(
            previewRow("session_messages", {
                id: "m1",
                role: "user",
                content: "hello world",
            }),
        ).toBe("[user] hello world");
        const long = "a".repeat(120);
        const preview = previewRow("session_messages", {
            id: "m2",
            role: "user",
            content: long,
        });
        expect(preview.endsWith("…")).toBe(true);
        expect(preview.length).toBeLessThan(80);
    });

    it("falls back to id for unknown table names", () => {
        expect(previewRow("unknown_table", {id: "abc"})).toBe("abc");
    });
});

describe("APPEND_ONLY_TABLES + HIGH_VOLUME_TABLES", () => {
    it("includes the expected append-only tables", () => {
        for (const t of [
            "learning_sessions",
            "session_messages",
            "progress_commits",
            "method_switches",
        ]) {
            expect(APPEND_ONLY_TABLES.has(t)).toBe(true);
        }
    });

    it("flags messages + step evaluations as high-volume", () => {
        expect(HIGH_VOLUME_TABLES.has("session_messages")).toBe(true);
        expect(HIGH_VOLUME_TABLES.has("step_evaluations")).toBe(true);
        expect(HIGH_VOLUME_TABLES.has("learning_projects")).toBe(false);
    });
});

describe("sort + filter helpers", () => {
    const tables = [
        {
            table: "z_empty",
            append_only: false,
            high_volume: false,
            added: [],
            removed: [],
            changed: [],
            unchanged: 10,
            total_old: 10,
            total_new: 10,
        },
        {
            table: "a_many",
            append_only: false,
            high_volume: false,
            added: [{id: "x", preview: "x"}, {id: "y", preview: "y"}],
            removed: [],
            changed: [],
            unchanged: 0,
            total_old: 0,
            total_new: 2,
        },
        {
            table: "m_some",
            append_only: false,
            high_volume: false,
            added: [{id: "z", preview: "z"}],
            removed: [],
            changed: [],
            unchanged: 0,
            total_old: 0,
            total_new: 1,
        },
    ];

    it("filterChangedTables drops tables with no deltas", () => {
        const filtered = filterChangedTables(tables);
        expect(filtered.map((t) => t.table)).toEqual(["a_many", "m_some"]);
    });

    it("sortTablesByDelta orders descending by total delta", () => {
        const sorted = sortTablesByDelta(tables);
        expect(sorted.map((t) => t.table)).toEqual(["a_many", "m_some", "z_empty"]);
    });

    it("sortTablesAlphabetically orders by table name", () => {
        const sorted = sortTablesAlphabetically(tables);
        expect(sorted.map((t) => t.table)).toEqual(["a_many", "m_some", "z_empty"]);
    });
});

describe("deepEqual + asDate (internal helpers)", () => {
    it("deepEqual matches the comparison contract", () => {
        expect(__test__.deepEqual({a: 1, b: [1, 2]}, {a: 1, b: [1, 2]})).toBe(true);
        expect(__test__.deepEqual({a: 1, b: [1, 2]}, {a: 1, b: [1, 3]})).toBe(false);
        expect(__test__.deepEqual(null, null)).toBe(true);
        expect(__test__.deepEqual(null, undefined)).toBe(false);
        expect(__test__.deepEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it("asDate truncates ISO strings to YYYY-MM-DD", () => {
        expect(__test__.asDate("2026-05-18T12:00:00Z")).toBe("2026-05-18");
        expect(__test__.asDate("not-a-date")).toBe("not-a-date");
        expect(__test__.asDate(null)).toBe("(no date)");
    });
});
