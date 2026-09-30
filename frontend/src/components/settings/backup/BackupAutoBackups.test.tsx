/**
 * BackupAutoBackups spacing pin (#2549).
 *
 * The action row ("Jetzt sichern" et al.) sat flush against the
 * preceding auto-backup label / storage-pressure warning: neither
 * ``backup-auto-toggle`` nor ``backup-actions`` had a matching CSS
 * rule anywhere in styles/ (bare JSX class names, no styling), and
 * neither carried a spacing utility.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notifyError } = vi.hoisted(() => ({ notifyError: vi.fn() }));
vi.mock("../../../utils/notify", () => ({
    notify: { error: notifyError, success: vi.fn(), info: vi.fn() },
}));

vi.mock("../../../storage/backup/auto-backup", () => ({
    checkTimeTrigger: vi.fn(async () => {}),
    deleteAutoBackup: vi.fn(async () => {}),
    estimateStoragePressure: vi.fn(async () => null),
    isAutoBackupEnabled: vi.fn(() => false),
    listAutoBackups: vi.fn(async () => []),
    maybeRunAutoBackup: vi.fn(async () => {}),
    restoreFromAutoBackup: vi.fn(async () => ({ restored: {} })),
    runAutoBackupNow: vi.fn(async () => {}),
    setAutoBackupEnabled: vi.fn(),
}));

import { BackupAutoBackups } from "./BackupAutoBackups";
import * as autoBackup from "../../../storage/backup/auto-backup";

describe("BackupAutoBackups spacing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("gives the action row vertical spacing from the label above it", async () => {
        render(
            <BackupAutoBackups
                userId="u-1"
                onRestored={() => {}}
                onLoadIntoCompare={() => {}}
            />,
        );
        const actions = await screen.findByTestId("backup-auto-run");
        const row = actions.closest(".backup-actions");
        expect(row?.className).toMatch(/\bmt-\d/);
    });

    it("tells the user when deleting an automatic backup fails (#3384)", async () => {
        vi.mocked(autoBackup.listAutoBackups).mockResolvedValue([
            { id: "ab-1", created_at: "2026-09-30T10:00:00Z", total_records: 3 } as never,
        ]);
        vi.mocked(autoBackup.deleteAutoBackup).mockRejectedValue(new Error("blocked"));
        render(
            <BackupAutoBackups
                userId="u-1"
                onRestored={() => {}}
                onLoadIntoCompare={() => {}}
            />,
        );
        fireEvent.click(await screen.findByTestId("backup-auto-delete-ab-1"));
        await waitFor(() => expect(notifyError).toHaveBeenCalled());
        expect(String(notifyError.mock.calls[0][0])).toContain("blocked");
    });
});
