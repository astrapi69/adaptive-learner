/**
 * #3787 - the dialog of the restore's second mode. A backup is merged by
 * default; "Reset to the backup" has to be chosen, and then confirmed in a
 * dialog that says what is lost, before anything is sent.
 *
 * The storage call is spied on: what a reset does to the data is pinned by
 * ``storage/backup/reset/reset-restore.test.ts`` (browser) and
 * ``backend/tests/test_backup_reset.py`` (server).
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";

import BackupSection from "./BackupSection";
import {I18nProvider} from "../../../hooks/ui/useI18n";
import {_resetStorageCacheForTests, getStorage} from "../../../storage";
import {setUserId} from "../../../lib/learning/learnerState";
import type {BackupPayload, RestoreSummary} from "../../../types/domain";
import {notify} from "../../../utils/notify";

vi.mock("../../../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

// Plain functions, not vi.fn: afterEach runs vi.restoreAllMocks().
vi.mock("../../../storage/backup/auto-backup", () => ({
    isAutoBackupEnabled: () => false,
    setAutoBackupEnabled: () => undefined,
    listAutoBackups: async () => [],
    estimateStoragePressure: async () => ({is_pressured: false, usage_ratio: 0}),
    checkTimeTrigger: () => null,
    maybeRunAutoBackup: async () => undefined,
    runAutoBackupNow: async () => undefined,
    getAutoBackupPayload: async () => null,
    deleteAutoBackup: async () => undefined,
    restoreFromAutoBackup: async () => ({
        user_id: "",
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        tables: {},
    }),
}));

const USER_ID = "user-12345678";

function payloadOf(owner: string): BackupPayload {
    return {
        format: "adaptive-learner-backup",
        version: "1.2.0",
        app_version: "1.2.0-test",
        created_at: "2026-05-20T10:00:00.000Z",
        user_id: owner,
        storage_mode: "api",
        data: {users: [], learning_projects: []},
        stats: {total_records: 5, tables: {users: 1, learning_projects: 4}},
    };
}

const SUMMARY: RestoreSummary = {
    user_id: USER_ID,
    inserted: 2,
    updated: 1,
    skipped: 0,
    errors: [],
    tables: {},
};

/** Render the section and load ``payload`` as the chosen backup file. */
async function loadBackup(payload: BackupPayload) {
    vi.spyOn(getStorage().backup, "stats").mockResolvedValue({
        user_id: USER_ID,
        total_records: 3,
        tables: {users: 1, learning_projects: 2},
    });
    render(
        <I18nProvider>
            <BackupSection />
        </I18nProvider>,
    );
    const input = screen.getByTestId("backup-file-input") as HTMLInputElement;
    const file = new File([JSON.stringify(payload)], "backup.json", {
        type: "application/json",
    });
    await act(async () => {
        fireEvent.change(input, {target: {files: [file]}});
    });
    await waitFor(() => {
        expect(screen.getByTestId("backup-comparison")).toBeInTheDocument();
    });
}

function radio(mode: "merge" | "reset"): HTMLInputElement {
    return screen.getByTestId(`backup-restore-mode-${mode}`) as HTMLInputElement;
}

async function click(testId: string) {
    await act(async () => {
        fireEvent.click(screen.getByTestId(testId));
    });
}

beforeEach(() => {
    localStorage.clear();
    setUserId(USER_ID);
    _resetStorageCacheForTests();
    vi.mocked(notify.success).mockClear();
    vi.mocked(notify.error).mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

describe("BackupSection: merge or reset (#3787)", () => {
    it("offers both modes with the merge chosen", async () => {
        await loadBackup(payloadOf(USER_ID));

        expect(radio("merge").checked).toBe(true);
        expect(radio("reset").checked).toBe(false);
        expect(radio("reset").disabled).toBe(false);
    });

    it("merges without asking again when the mode is left alone", async () => {
        const importSpy = vi.spyOn(getStorage().backup, "import").mockResolvedValue(SUMMARY);
        const payload = payloadOf(USER_ID);
        await loadBackup(payload);

        await click("backup-confirm");

        await waitFor(() => {
            expect(importSpy).toHaveBeenCalledWith(USER_ID, payload);
        });
        expect(screen.queryByTestId("backup-reset-confirm")).not.toBeInTheDocument();
    });

    it("asks before a reset and sends nothing until it is confirmed", async () => {
        const importSpy = vi.spyOn(getStorage().backup, "import").mockResolvedValue(SUMMARY);
        const payload = payloadOf(USER_ID);
        await loadBackup(payload);

        await click("backup-restore-mode-reset");
        await click("backup-confirm");

        // The dialog is open, says that the sets are shared, and nothing was sent.
        expect(screen.getByTestId("backup-reset-confirm")).toBeInTheDocument();
        expect(screen.getByTestId("backup-reset-shared-sets")).toBeInTheDocument();
        expect(importSpy).not.toHaveBeenCalled();

        await click("backup-reset-confirm-confirm");

        await waitFor(() => {
            expect(importSpy).toHaveBeenCalledWith(USER_ID, payload, {mode: "reset"});
        });
        await waitFor(() => {
            expect(vi.mocked(notify.success)).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByTestId("backup-reset-confirm")).not.toBeInTheDocument();
    });

    it("sends nothing when the reset is cancelled in the dialog", async () => {
        const importSpy = vi.spyOn(getStorage().backup, "import").mockResolvedValue(SUMMARY);
        await loadBackup(payloadOf(USER_ID));

        await click("backup-restore-mode-reset");
        await click("backup-confirm");
        await click("backup-reset-confirm-cancel");

        expect(importSpy).not.toHaveBeenCalled();
        expect(screen.queryByTestId("backup-reset-confirm")).not.toBeInTheDocument();
        // The backup is still loaded and the choice still stands.
        expect(radio("reset").checked).toBe(true);
    });

    it("does not offer the reset for the backup of another profile, and says why", async () => {
        const importSpy = vi.spyOn(getStorage().backup, "import").mockResolvedValue(SUMMARY);
        const payload = payloadOf("another-profile");
        await loadBackup(payload);

        expect(radio("reset").disabled).toBe(true);
        expect(radio("merge").checked).toBe(true);
        expect(screen.getByTestId("backup-reset-foreign-unavailable")).toBeInTheDocument();

        // A click on the disabled choice changes nothing; the backup merges.
        await click("backup-restore-mode-reset");
        await click("backup-confirm");
        await waitFor(() => {
            expect(importSpy).toHaveBeenCalledWith(USER_ID, payload);
        });
    });

    it("says that nothing was changed when a reset is not applied", async () => {
        const refused = new Error("The reset was not applied and nothing was changed: tags");
        vi.spyOn(getStorage().backup, "import").mockRejectedValue(refused);
        await loadBackup(payloadOf(USER_ID));

        await click("backup-restore-mode-reset");
        await click("backup-confirm");
        await click("backup-reset-confirm-confirm");

        await waitFor(() => {
            expect(vi.mocked(notify.error)).toHaveBeenCalledTimes(1);
        });
        const [message, options] = vi.mocked(notify.error).mock.calls[0];
        // The reset's own text, not the merge's "Restore failed.".
        expect(message).not.toMatch(/Restore failed|Wiederherstellung fehlgeschlagen/);
        expect(options).toEqual({error: refused});
        expect(vi.mocked(notify.success)).not.toHaveBeenCalled();
    });
});
