/**
 * Regression: the Backup "Compare Backups" picker must accept an EXP-031
 * ``.alb`` (ZIP) container, not only a legacy ``.json`` file.
 *
 * Before the fix, the hook's local reader did ``file.text()`` +
 * ``JSON.parse`` directly, so a ``.alb`` file (binary ZIP) failed to
 * parse and the compare slot reported "not a valid backup". The reader
 * now delegates to the shared, magic-byte-based ``readBackupFile`` so a
 * ``.alb`` backup is comparable, while legacy ``.json`` still works.
 */

import {act, renderHook, waitFor} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import {useBackupCompare} from "./useBackupCompare";
import {buildAlbBytes} from "../../lib/backup/albContainer";
import type {BackupPayload} from "../../types/domain";

vi.mock("../ui/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fallback: string) => fallback}),
}));

vi.mock("../../storage", () => ({
    getStorage: () => ({backup: {export: vi.fn()}}),
}));

const validPayload: BackupPayload = {
    format: "adaptive-learner-backup",
    version: "1.3.0",
    app_version: "1.88.0",
    created_at: "2026-01-01T00:00:00.000Z",
    user_id: "user-1",
    storage_mode: "dexie",
    data: {users: [{id: "user-1"}]},
    stats: {total_records: 1, tables: {users: 1}},
} as unknown as BackupPayload;

function changeEventFor(file: File): React.ChangeEvent<HTMLInputElement> {
    return {
        target: {files: [file], value: ""},
    } as unknown as React.ChangeEvent<HTMLInputElement>;
}

describe("useBackupCompare — .alb + legacy .json picker", () => {
    it("fills the compare slot from an .alb (ZIP) file", async () => {
        const {result} = renderHook(() => useBackupCompare("user-1"));
        const alb = new File([buildAlbBytes(validPayload)], "backup.alb");

        await act(async () => {
            await result.current.handleCompareFilePick("a", changeEventFor(alb));
        });

        await waitFor(() => {
            expect(result.current.compareError).toBeNull();
            expect(result.current.compareA?.payload.user_id).toBe("user-1");
            expect(result.current.compareA?.label).toBe("backup.alb");
        });
    });

    it("still fills the compare slot from a legacy .json file", async () => {
        const {result} = renderHook(() => useBackupCompare("user-1"));
        const json = new File([JSON.stringify(validPayload)], "backup.json", {
            type: "application/json",
        });

        await act(async () => {
            await result.current.handleCompareFilePick("b", changeEventFor(json));
        });

        await waitFor(() => {
            expect(result.current.compareError).toBeNull();
            expect(result.current.compareB?.payload.user_id).toBe("user-1");
        });
    });

    it("rejects a non-backup file with a friendly error, not a crash", async () => {
        const {result} = renderHook(() => useBackupCompare("user-1"));
        const junk = new File(["just some notes"], "notes.txt", {
            type: "text/plain",
        });

        await act(async () => {
            await result.current.handleCompareFilePick("a", changeEventFor(junk));
        });

        await waitFor(() => {
            expect(result.current.compareError).not.toBeNull();
            expect(result.current.compareA).toBeNull();
        });
    });
});
