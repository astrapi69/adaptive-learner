/**
 * BackupAutoBackups spacing pin (#2549).
 *
 * The action row ("Jetzt sichern" et al.) sat flush against the
 * preceding auto-backup label / storage-pressure warning: neither
 * ``backup-auto-toggle`` nor ``backup-actions`` had a matching CSS
 * rule anywhere in styles/ (bare JSX class names, no styling), and
 * neither carried a spacing utility.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
