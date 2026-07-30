/**
 * exportBackupNow (#2161 condition 4): one-click backup offer must produce the
 * same file as the Settings > Data export and report saved vs cancelled so a
 * caller can confirm without re-inlining the flow.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {exportBackupNow} from "./exportBackupNow";

const exportBackup = vi.fn();
const saveBackupToDisk = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({backup: {export: exportBackup}}),
}));
vi.mock("./localStorageSnapshot", () => ({
    withLocalStorageSnapshot: (p: unknown) => p,
}));
vi.mock("../../utils/backup-download", () => ({
    backupFilename: () => "adaptive-learner-backup-2026-07-30-user1234.alb",
    saveBackupToDisk: (...args: unknown[]) => saveBackupToDisk(...args),
}));

const payload = {stats: {total_records: 42}};

beforeEach(() => {
    vi.clearAllMocks();
    exportBackup.mockResolvedValue(payload);
});

describe("exportBackupNow (#2161)", () => {
    it("saves and reports the filename + record count", async () => {
        saveBackupToDisk.mockResolvedValue({method: "picker", filename: "chosen.alb"});
        const result = await exportBackupNow("user1234");
        expect(exportBackup).toHaveBeenCalledWith("user1234");
        expect(result).toEqual({status: "saved", filename: "chosen.alb", records: 42});
    });

    it("reports cancelled when the user dismisses the save dialog", async () => {
        saveBackupToDisk.mockResolvedValue({method: "cancelled"});
        expect(await exportBackupNow("user1234")).toEqual({status: "cancelled"});
    });

    it("propagates a real export failure to the caller", async () => {
        exportBackup.mockRejectedValue(new Error("export boom"));
        await expect(exportBackupNow("user1234")).rejects.toThrow(/export boom/);
    });
});
