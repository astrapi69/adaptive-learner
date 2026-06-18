/**
 * Tests for the backup save helpers (BACKUP-DIR-EXPORT-01).
 *
 * Covers the File System Access API path (mocked
 * ``showSaveFilePicker``), the download fallback, and the
 * user-cancelled (AbortError) branch.
 */

import {afterEach, describe, expect, it, vi} from "vitest";

import {
    backupFilename,
    saveBackupToDisk,
    supportsSaveFilePicker,
    triggerBackupDownload,
} from "./backup-download";
import type {BackupPayload} from "../types/domain";
import {isZipBytes, parseAlbBytes} from "../lib/backup/albContainer";

const payload: BackupPayload = {
    format: "adaptive-learner-backup",
    version: "1.2.0",
    app_version: "test",
    created_at: "2026-06-01T10:00:00.000Z",
    user_id: "user-12345678",
    storage_mode: "dexie",
    data: {users: []},
    stats: {total_records: 0, tables: {users: 0}},
};

afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as {showSaveFilePicker?: unknown}).showSaveFilePicker;
});

describe("backupFilename", () => {
    it("uses an ISO date and the user-id prefix", () => {
        const name = backupFilename("abcdef1234567890");
        expect(name).toMatch(/^adaptive-learner-backup-\d{4}-\d{2}-\d{2}-abcdef12\.alb$/);
    });
});

describe("supportsSaveFilePicker", () => {
    it("is false when the API is absent (happy-dom default)", () => {
        expect(supportsSaveFilePicker()).toBe(false);
    });

    it("is true when showSaveFilePicker is present", () => {
        (window as unknown as {showSaveFilePicker: unknown}).showSaveFilePicker =
            () => Promise.resolve();
        expect(supportsSaveFilePicker()).toBe(true);
    });
});

describe("saveBackupToDisk", () => {
    it("writes through the native picker when available", async () => {
        const write = vi.fn().mockResolvedValue(undefined);
        const close = vi.fn().mockResolvedValue(undefined);
        const createWritable = vi.fn().mockResolvedValue({write, close});
        const picker = vi.fn().mockResolvedValue({
            name: "my-backup.json",
            createWritable,
        });
        (window as unknown as {showSaveFilePicker: unknown}).showSaveFilePicker =
            picker;

        const result = await saveBackupToDisk(payload, "suggested.json");

        expect(picker).toHaveBeenCalledWith(
            expect.objectContaining({suggestedName: "suggested.json"}),
        );
        expect(write).toHaveBeenCalledOnce();
        // The written content is the .alb (ZIP) bytes — EXP-031.
        const written = write.mock.calls[0][0] as Uint8Array;
        expect(isZipBytes(written)).toBe(true);
        expect(parseAlbBytes(written).payload).toMatchObject({
            format: "adaptive-learner-backup",
        });
        expect(close).toHaveBeenCalledOnce();
        expect(result).toEqual({method: "picker", filename: "my-backup.json"});
    });

    it("reports cancelled when the user dismisses the dialog", async () => {
        const abort = new DOMException("The user aborted a request.", "AbortError");
        (window as unknown as {showSaveFilePicker: unknown}).showSaveFilePicker =
            vi.fn().mockRejectedValue(abort);

        const result = await saveBackupToDisk(payload, "x.json");
        expect(result).toEqual({method: "cancelled"});
    });

    it("falls back to download when the picker is unavailable", async () => {
        const clickSpy = vi.fn();
        const originalCreate = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
            const el = originalCreate(tag);
            if (tag === "a") {
                Object.defineProperty(el, "click", {value: clickSpy});
            }
            return el;
        });
        if (typeof URL.createObjectURL !== "function") {
            (URL as unknown as {createObjectURL: () => string}).createObjectURL =
                () => "blob:mock";
            (URL as unknown as {revokeObjectURL: () => void}).revokeObjectURL =
                () => undefined;
        }

        const result = await saveBackupToDisk(payload, "fallback.json");
        expect(clickSpy).toHaveBeenCalledOnce();
        expect(result).toEqual({method: "download", filename: "fallback.json"});
    });

    it("falls back to download when the native write fails", async () => {
        (window as unknown as {showSaveFilePicker: unknown}).showSaveFilePicker = vi
            .fn()
            .mockResolvedValue({
                name: "x.json",
                createWritable: vi
                    .fn()
                    .mockRejectedValue(new Error("disk full")),
            });
        const clickSpy = vi.fn();
        const originalCreate = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
            const el = originalCreate(tag);
            if (tag === "a") {
                Object.defineProperty(el, "click", {value: clickSpy});
            }
            return el;
        });
        if (typeof URL.createObjectURL !== "function") {
            (URL as unknown as {createObjectURL: () => string}).createObjectURL =
                () => "blob:mock";
            (URL as unknown as {revokeObjectURL: () => void}).revokeObjectURL =
                () => undefined;
        }

        const result = await saveBackupToDisk(payload, "fallback.json");
        expect(clickSpy).toHaveBeenCalledOnce();
        expect(result.method).toBe("download");
    });
});

describe("triggerBackupDownload", () => {
    it("clicks a temporary anchor with the download attribute", () => {
        const clickSpy = vi.fn();
        const originalCreate = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
            const el = originalCreate(tag);
            if (tag === "a") {
                Object.defineProperty(el, "click", {value: clickSpy});
            }
            return el;
        });
        if (typeof URL.createObjectURL !== "function") {
            (URL as unknown as {createObjectURL: () => string}).createObjectURL =
                () => "blob:mock";
            (URL as unknown as {revokeObjectURL: () => void}).revokeObjectURL =
                () => undefined;
        }
        triggerBackupDownload(payload, "out.json");
        expect(clickSpy).toHaveBeenCalledOnce();
    });
});
