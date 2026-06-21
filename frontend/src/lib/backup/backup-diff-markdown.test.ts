/**
 * Backup diff Markdown renderer tests (v1.12.0 / Phase 25E).
 *
 * Pins the spec format:
 *   - Top header (Date, Backup A/B labels + dates + versions +
 *     record counts, Delta one-liner).
 *   - Summary table with zero-delta tables OMITTED.
 *   - Per-table sections (zero-delta omitted) with Added /
 *     Removed / Changed subsections.
 *   - High-volume tables (session_messages, etc.) render a
 *     count summary instead of per-record previews.
 *   - Field-level diff renders ``field: old → new``.
 *   - Footer watermark with the app version.
 */

import {describe, expect, it} from "vitest";

import {renderDiffMarkdown, __test__} from "./backup-diff-markdown";
import type {BackupDiff} from "./backup-diff";

function buildDiff(overrides: Partial<BackupDiff> = {}): BackupDiff {
    return {
        backup_a: {
            created_at: "2026-05-10T00:00:00Z",
            app_version: "v1.11.0",
            user_id: "u-1",
            storage_mode: "dexie",
            total_records: 100,
        },
        backup_b: {
            created_at: "2026-05-18T00:00:00Z",
            app_version: "v1.12.0",
            user_id: "u-1",
            storage_mode: "dexie",
            total_records: 130,
        },
        tables: [],
        totals: {added: 0, removed: 0, changed: 0, unchanged: 0},
        ...overrides,
    };
}

describe("renderDiffMarkdown", () => {
    it("emits the header with dates + versions + record counts", () => {
        const diff = buildDiff();
        const md = renderDiffMarkdown(diff, {
            labelA: "Backup A",
            labelB: "Backup B",
            now: "2026-05-20",
        });
        expect(md).toContain("# Backup Comparison Report");
        expect(md).toContain("**Date:** 2026-05-20");
        expect(md).toContain("**Backup A:** 2026-05-10, v1.11.0, 100 records");
        expect(md).toContain("**Backup B:** 2026-05-18, v1.12.0, 130 records");
    });

    it("renders the Delta one-liner from the totals", () => {
        const diff = buildDiff({
            totals: {added: 76, removed: 0, changed: 12, unchanged: 835},
        });
        const md = renderDiffMarkdown(diff, {
            labelA: "Backup A",
            labelB: "Backup B",
        });
        expect(md).toContain(
            "**Delta:** +76 added, -0 removed, 12 changed, 835 unchanged",
        );
    });

    it("OMITS the summary table when all tables are zero-delta", () => {
        const diff = buildDiff({
            tables: [
                {
                    table: "users",
                    append_only: false,
                    high_volume: false,
                    added: [],
                    removed: [],
                    changed: [],
                    unchanged: 1,
                    total_old: 1,
                    total_new: 1,
                },
            ],
            totals: {added: 0, removed: 0, changed: 0, unchanged: 1},
        });
        const md = renderDiffMarkdown(diff, {labelA: "A", labelB: "B"});
        expect(md).toContain("_No differences between the two backups._");
        // No "## users" section either.
        expect(md).not.toContain("## users");
    });

    it("emits the summary table for non-zero-delta tables only", () => {
        const diff = buildDiff({
            tables: [
                {
                    table: "learning_sessions",
                    append_only: true,
                    high_volume: false,
                    added: [{id: "s1", preview: "preview-1"}],
                    removed: [],
                    changed: [],
                    unchanged: 5,
                    total_old: 5,
                    total_new: 6,
                },
                {
                    table: "users",  // zero delta, must be skipped
                    append_only: false,
                    high_volume: false,
                    added: [],
                    removed: [],
                    changed: [],
                    unchanged: 1,
                    total_old: 1,
                    total_new: 1,
                },
            ],
            totals: {added: 1, removed: 0, changed: 0, unchanged: 6},
        });
        const md = renderDiffMarkdown(diff, {labelA: "A", labelB: "B"});
        expect(md).toContain("| Table | Added | Removed | Changed | Unchanged |");
        expect(md).toContain("| learning_sessions | +1 | -0 | ~0 | 5 |");
        expect(md).not.toContain("| users |");
    });

    it("emits per-table sections for added / removed / changed records", () => {
        const diff = buildDiff({
            tables: [
                {
                    table: "learning_projects",
                    append_only: false,
                    high_volume: false,
                    added: [{id: "p2", preview: "Italian (20 min/day)"}],
                    removed: [{id: "p3", preview: "Greek (15 min/day)"}],
                    changed: [
                        {
                            id: "p1",
                            preview: "Spanish (45 min/day)",
                            fields: [
                                {field: "daily_minutes", old_value: 30, new_value: 45},
                                {
                                    field: "timeframe",
                                    old_value: "3 Monate",
                                    new_value: "6 Monate",
                                },
                            ],
                        },
                    ],
                    unchanged: 0,
                    total_old: 2,
                    total_new: 2,
                },
            ],
            totals: {added: 1, removed: 1, changed: 1, unchanged: 0},
        });
        const md = renderDiffMarkdown(diff, {labelA: "A", labelB: "B"});
        expect(md).toContain("## learning_projects (+1 added, -1 removed, ~1 changed)");
        expect(md).toContain("### Added");
        expect(md).toContain("- Italian (20 min/day)");
        expect(md).toContain("### Removed");
        expect(md).toContain("- Greek (15 min/day)");
        expect(md).toContain("### Changed");
        expect(md).toContain("- **Spanish (45 min/day)**:");
        expect(md).toContain("  - daily_minutes: 30 → 45");
        expect(md).toContain('  - timeframe: "3 Monate" → "6 Monate"');
    });

    it("collapses high-volume tables to a count summary", () => {
        const diff = buildDiff({
            tables: [
                {
                    table: "session_messages",
                    append_only: true,
                    high_volume: true,
                    added: Array.from({length: 47}, (_, i) => ({
                        id: `m${i}`,
                        preview: `msg ${i}`,
                    })),
                    removed: [],
                    changed: [],
                    unchanged: 412,
                    total_old: 412,
                    total_new: 459,
                },
            ],
            totals: {added: 47, removed: 0, changed: 0, unchanged: 412},
        });
        const md = renderDiffMarkdown(diff, {labelA: "A", labelB: "B"});
        expect(md).toContain("## session_messages (+47 added)");
        expect(md).toContain(
            "47 new records added (detail omitted for brevity).",
        );
        // The per-record list must NOT appear.
        expect(md).not.toContain("- msg 0");
    });

    it("ends with the version watermark", () => {
        const diff = buildDiff();
        const md = renderDiffMarkdown(diff, {labelA: "A", labelB: "B"});
        expect(md).toMatch(/\*Generated by Adaptive Learner v[\d.]+\*/);
    });

    it("escapes pipe characters in string values to keep tables intact", () => {
        const md = __test__.formatValueShort("foo|bar|baz");
        expect(md).toBe('"foo\\|bar\\|baz"');
    });

    it("formats null / undefined / numbers / booleans / objects", () => {
        expect(__test__.formatValueShort(null)).toBe("null");
        expect(__test__.formatValueShort(undefined)).toBe("(unset)");
        expect(__test__.formatValueShort(42)).toBe("42");
        expect(__test__.formatValueShort(true)).toBe("true");
        expect(__test__.formatValueShort({a: 1})).toBe('{"a":1}');
    });

    it("truncates long string + object values", () => {
        const longStr = "x".repeat(200);
        const result = __test__.formatValueShort(longStr);
        expect(result.length).toBeLessThan(120);
        expect(result.endsWith('…"')).toBe(true);
    });
});
