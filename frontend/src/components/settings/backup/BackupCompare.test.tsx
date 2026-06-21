/**
 * BackupCompare component tests (v1.12.0 / Phase 25B).
 *
 * Renders the diff produced by ``lib/backup-diff`` and verifies:
 *   - Header totals chips match the diff
 *   - Tables collapsed by default; expand reveals records
 *   - Changed records expand to show field-level diff
 *   - Filter "Hide unchanged tables" removes zero-delta cards
 *   - Empty diff (both backups identical) shows the empty hint
 */

import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {BackupPayload} from "../../../types/domain";
import {BackupCompare} from "./BackupCompare";

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

describe("BackupCompare", () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders totals + per-table cards once the diff completes", async () => {
        const a = buildPayload({
            learning_projects: [
                {id: "p1", topic: "Spanish", daily_minutes: 30, updated_at: "x"},
            ],
        });
        const b = buildPayload({
            learning_projects: [
                {id: "p1", topic: "Spanish", daily_minutes: 45, updated_at: "y"},
                {id: "p2", topic: "Python", daily_minutes: 60, updated_at: "y"},
            ],
        });
        render(<BackupCompare backupA={a} backupB={b} />);
        await screen.findByTestId("backup-compare");
        await waitFor(() => {
            expect(screen.getByTestId("totals-added").textContent).toBe("+1");
        });
        expect(screen.getByTestId("totals-removed").textContent).toBe("-0");
        expect(screen.getByTestId("totals-changed").textContent).toBe("~1");
        expect(
            screen.getByTestId("backup-compare-table-learning_projects"),
        ).toBeInTheDocument();
    });

    it("expanding a table reveals added/changed records", async () => {
        const a = buildPayload({
            learning_projects: [
                {id: "p1", topic: "Spanish", daily_minutes: 30, updated_at: "x"},
            ],
        });
        const b = buildPayload({
            learning_projects: [
                {id: "p1", topic: "Spanish", daily_minutes: 45, updated_at: "y"},
                {id: "p2", topic: "Python", daily_minutes: 60, updated_at: "y"},
            ],
        });
        render(<BackupCompare backupA={a} backupB={b} />);
        await screen.findByTestId("backup-compare");
        await waitFor(() => {
            expect(
                screen.getByTestId("backup-compare-toggle-learning_projects"),
            ).toBeInTheDocument();
        });
        fireEvent.click(
            screen.getByTestId("backup-compare-toggle-learning_projects"),
        );
        expect(
            await screen.findByTestId(
                "backup-compare-record-added-learning_projects-p2",
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId(
                "backup-compare-record-changed-learning_projects-p1",
            ),
        ).toBeInTheDocument();
    });

    it("expanding a changed record reveals the field-level diff table", async () => {
        const a = buildPayload({
            learning_projects: [
                {id: "p1", topic: "Spanish", daily_minutes: 30, updated_at: "x"},
            ],
        });
        const b = buildPayload({
            learning_projects: [
                {id: "p1", topic: "Spanish", daily_minutes: 45, updated_at: "y"},
            ],
        });
        render(<BackupCompare backupA={a} backupB={b} />);
        await waitFor(() => {
            expect(
                screen.getByTestId("backup-compare-toggle-learning_projects"),
            ).toBeInTheDocument();
        });
        fireEvent.click(
            screen.getByTestId("backup-compare-toggle-learning_projects"),
        );
        fireEvent.click(
            await screen.findByTestId(
                "backup-compare-changed-toggle-learning_projects-p1",
            ),
        );
        const fieldsTable = await screen.findByTestId(
            "backup-compare-fields-learning_projects-p1",
        );
        expect(fieldsTable).toBeInTheDocument();
        expect(fieldsTable.textContent).toContain("daily_minutes");
        expect(fieldsTable.textContent).toContain("30");
        expect(fieldsTable.textContent).toContain("45");
    });

    it("'Hide unchanged tables' filter is on by default; toggle reveals zero-delta cards", async () => {
        const a = buildPayload({
            learning_projects: [
                {id: "p1", topic: "Spanish", daily_minutes: 30, updated_at: "x"},
            ],
            tags: [{id: "t1", user_id: "u-1", name: "vocab"}],
        });
        // Same payload twice = zero delta everywhere.
        const b = buildPayload({
            learning_projects: [
                {id: "p1", topic: "Spanish", daily_minutes: 30, updated_at: "x"},
            ],
            tags: [{id: "t1", user_id: "u-1", name: "vocab"}],
        });
        render(<BackupCompare backupA={a} backupB={b} />);
        await screen.findByTestId("backup-compare");
        await waitFor(() => {
            // With "hide unchanged" on (default), the empty-state
            // hint renders.
            expect(
                screen.getByTestId("backup-compare-empty"),
            ).toBeInTheDocument();
        });
        // Toggle the filter off → table cards reappear even though
        // they show only unchanged.
        await act(async () => {
            fireEvent.click(screen.getByTestId("backup-compare-hide-unchanged"));
        });
        expect(
            screen.getByTestId("backup-compare-table-learning_projects"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("backup-compare-table-tags"),
        ).toBeInTheDocument();
    });

    it("export button is hidden when hideExport=true", async () => {
        const a = buildPayload({
            learning_projects: [
                {id: "p1", topic: "Spanish", daily_minutes: 30, updated_at: "x"},
            ],
        });
        const b = buildPayload({learning_projects: []});
        render(<BackupCompare backupA={a} backupB={b} hideExport />);
        await screen.findByTestId("backup-compare");
        expect(
            screen.queryByTestId("backup-compare-export-md"),
        ).not.toBeInTheDocument();
    });
});
