/**
 * BackupSection tests (Phase 15C).
 *
 * Mocks the storage layer's backup namespace so the component
 * is exercised without a backend or IndexedDB. Covers:
 *
 *   - Renders the action buttons + section title.
 *   - "Create Backup" triggers a download (anchor click).
 *   - Last-backup timestamp is read from localStorage and shown.
 *   - File upload parses the JSON, shows the comparison table,
 *     and Confirm fires the import handler.
 *   - Invalid format produces a toast and does NOT open the
 *     comparison dialog.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";

import BackupSection from "./BackupSection";
import {I18nProvider} from "../hooks/ui/useI18n";
import {_resetStorageCacheForTests, getStorage} from "../storage";
import {setUserId} from "../lib/learnerState";
import type {BackupPayload} from "../types/domain";
import {notify} from "../utils/notify";

vi.mock("../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

// Issue #53 — the auto-backup list (and its Restore / Delete /
// Compare-A / Compare-B buttons) only renders in Dexie mode and only
// when at least one auto-backup exists. Mock the auto-backup module so
// the list is populated without a real IndexedDB run.
const autoMock = vi.hoisted(() => ({
    entries: [] as {id: string; created_at: string; total_records: number}[],
}));
// NOTE: plain functions (not vi.fn) on purpose — the file's afterEach
// runs vi.restoreAllMocks(), which would strip vi.fn implementations
// and make listAutoBackups() return undefined for later tests.
vi.mock("../storage/backup/auto-backup", () => ({
    isAutoBackupEnabled: () => true,
    setAutoBackupEnabled: () => undefined,
    listAutoBackups: async () => autoMock.entries,
    estimateStoragePressure: async () => ({
        is_pressured: false,
        usage_ratio: 0,
    }),
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

const SEED_USER_ID = "user-12345678";

const samplePayload: BackupPayload = {
    format: "adaptive-learner-backup",
    version: "1.2.0",
    app_version: "1.2.0-test",
    created_at: "2026-05-20T10:00:00.000Z",
    user_id: SEED_USER_ID,
    storage_mode: "api",
    data: {users: [], learning_projects: []},
    stats: {
        total_records: 5,
        tables: {users: 1, learning_projects: 4},
    },
};

function renderSection() {
    return render(
        <I18nProvider>
            <BackupSection />
        </I18nProvider>,
    );
}

beforeEach(() => {
    localStorage.clear();
    setUserId(SEED_USER_ID);
    _resetStorageCacheForTests();
});

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

describe("BackupSection", () => {
    it("renders nothing when no user is set", () => {
        localStorage.clear();
        const {container} = renderSection();
        expect(container.firstChild).toBeNull();
    });

    it("renders the section title and action buttons", async () => {
        renderSection();
        expect(screen.getByTestId("settings-backup")).toBeInTheDocument();
        expect(screen.getByTestId("backup-export")).toBeInTheDocument();
        expect(screen.getByTestId("backup-import")).toBeInTheDocument();
    });

    // Issue #53 — the Backup section's buttons must be shadcn <Button>s
    // (correct variant + the 44px touch target the kit enforces via
    // min-h-11), not raw <button>s. This pins the auto-backup list
    // buttons that the button audit (#40) missed.
    it("renders the auto-backup buttons as shadcn Buttons with 44px targets (Dexie mode)", async () => {
        localStorage.setItem("adaptive-learner.storage_mode", "dexie");
        _resetStorageCacheForTests();
        // The I18nProvider caches the loaded catalog in a module-level
        // variable. In Dexie mode i18n.get() resolves with the bundled
        // German catalog and would poison that cache for the other
        // (English-fallback) tests in this file. Reject it so the cache
        // stays empty, exactly as it does in API mode (ECONNREFUSED).
        vi.spyOn(getStorage().i18n, "get").mockRejectedValue(
            new Error("i18n offline (test)"),
        );
        autoMock.entries = [
            {
                id: "ab-1",
                created_at: "2026-05-20T10:00:00.000Z",
                total_records: 42,
            },
        ];

        renderSection();

        // The auto-backup list renders only after the refresh effect
        // pulls the (mocked) entries.
        await waitFor(() => {
            expect(
                screen.getByTestId("backup-auto-restore-ab-1"),
            ).toBeInTheDocument();
        });

        const buttonIds = [
            "backup-auto-run", // "Back up now" — primary
            "backup-auto-restore-ab-1", // "Restore" — secondary
            "backup-auto-delete-ab-1", // "Delete" — destructive
            "backup-auto-compare-a-ab-1", // "Compare as A" — outline
            "backup-auto-compare-b-ab-1", // "Compare as B" — outline
        ];
        for (const id of buttonIds) {
            const btn = screen.getByTestId(id);
            expect(btn.tagName).toBe("BUTTON");
            // shadcn Button enforces the 44px touch target via min-h-11
            // on every size variant. A raw <button> would not carry it.
            expect(btn.className).toContain("min-h-11");
        }
        // Variant spot-checks: Delete is destructive, "Back up now" is
        // the brand primary.
        expect(screen.getByTestId("backup-auto-delete-ab-1").className).toContain(
            "bg-destructive",
        );
        expect(screen.getByTestId("backup-auto-run").className).toContain(
            "bg-primary",
        );
    });

    it("Create Backup triggers a download and persists last-backup timestamp", async () => {
        const exportSpy = vi
            .spyOn(getStorage().backup, "export")
            .mockResolvedValue(samplePayload);

        const clickSpy = vi.fn();
        const originalCreate = document.createElement.bind(document);
        const createSpy = vi
            .spyOn(document, "createElement")
            .mockImplementation((tagName: string) => {
                const el = originalCreate(tagName);
                if (tagName === "a") {
                    Object.defineProperty(el, "click", {value: clickSpy});
                }
                return el;
            });

        const url = "blob:mocked";
        // jsdom-style URL globals exist under happy-dom; provide stubs
        // in case they're undefined.
        if (typeof URL.createObjectURL !== "function") {
            (URL as unknown as {createObjectURL: () => string}).createObjectURL =
                () => url;
            (URL as unknown as {revokeObjectURL: () => void}).revokeObjectURL =
                () => undefined;
        }

        renderSection();
        await act(async () => {
            fireEvent.click(screen.getByTestId("backup-export"));
        });

        await waitFor(() => {
            expect(exportSpy).toHaveBeenCalledWith(SEED_USER_ID);
        });
        expect(clickSpy).toHaveBeenCalled();
        expect(localStorage.getItem("adaptive-learner.last_backup_at")).not.toBe(null);

        createSpy.mockRestore();
    });

    it("shows a 'Your backup contains' preview from the row counts", async () => {
        vi.spyOn(getStorage().backup, "stats").mockResolvedValue({
            user_id: SEED_USER_ID,
            total_records: 1234,
            tables: {
                element_errors: 247,
                lesson_progress: 15,
                user_badges: 28,
                users: 1,
            },
        });

        renderSection();

        await waitFor(() => {
            expect(screen.getByTestId("backup-contents")).toBeInTheDocument();
        });
        expect(
            screen.getByTestId("backup-contents-element_errors").textContent,
        ).toContain("247");
        expect(
            screen.getByTestId("backup-contents-lesson_progress").textContent,
        ).toContain("15");
        expect(
            screen.getByTestId("backup-contents-user_badges").textContent,
        ).toContain("28");
        expect(
            screen.getByTestId("backup-contents-total").textContent,
        ).toContain("1234");
        // A zero / absent table is not listed.
        expect(
            screen.queryByTestId("backup-contents-learning_sessions"),
        ).toBeNull();
    });

    it("hides the contents preview when there are no records", async () => {
        vi.spyOn(getStorage().backup, "stats").mockResolvedValue({
            user_id: SEED_USER_ID,
            total_records: 0,
            tables: {},
        });
        renderSection();
        // Give the effect a tick; the preview must stay hidden.
        await waitFor(() => {
            expect(screen.getByTestId("settings-backup")).toBeInTheDocument();
        });
        expect(screen.queryByTestId("backup-contents")).toBeNull();
    });

    it("shows last-backup timestamp when present in localStorage", () => {
        localStorage.setItem(
            "adaptive-learner.last_backup_at",
            new Date().toISOString(),
        );
        renderSection();
        expect(screen.getByTestId("backup-last-backup")).toBeInTheDocument();
    });

    it("shows reminder when last backup is older than 7 days", () => {
        const eightDaysAgo = new Date(
            Date.now() - 8 * 24 * 60 * 60 * 1000,
        ).toISOString();
        localStorage.setItem("adaptive-learner.last_backup_at", eightDaysAgo);
        renderSection();
        expect(screen.getByTestId("backup-reminder")).toBeInTheDocument();
    });

    it("file upload shows comparison table and Confirm invokes import", async () => {
        vi.spyOn(getStorage().backup, "stats").mockResolvedValue({
            user_id: SEED_USER_ID,
            total_records: 3,
            tables: {users: 1, learning_projects: 2},
        });
        const importSpy = vi.spyOn(getStorage().backup, "import").mockResolvedValue({
            user_id: SEED_USER_ID,
            inserted: 2,
            updated: 0,
            skipped: 3,
            errors: [],
            tables: {},
        });

        renderSection();
        const input = screen.getByTestId(
            "backup-file-input",
        ) as HTMLInputElement;
        const file = new File([JSON.stringify(samplePayload)], "backup.json", {
            type: "application/json",
        });
        await act(async () => {
            fireEvent.change(input, {target: {files: [file]}});
        });

        await waitFor(() => {
            expect(screen.getByTestId("backup-comparison")).toBeInTheDocument();
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId("backup-confirm"));
        });

        await waitFor(() => {
            expect(importSpy).toHaveBeenCalledWith(SEED_USER_ID, samplePayload);
        });
        expect(screen.getByTestId("backup-summary")).toBeInTheDocument();
    });

    it("rejects a file with the wrong format", async () => {
        // stats() also fires on mount for the contents preview; the
        // assertion below targets the file-change handler, so settle
        // the mount call first, then clear the spy.
        const statsSpy = vi.spyOn(getStorage().backup, "stats").mockResolvedValue({
            user_id: SEED_USER_ID,
            total_records: 0,
            tables: {},
        });
        renderSection();
        await waitFor(() => {
            expect(statsSpy).toHaveBeenCalled();
        });
        statsSpy.mockClear();

        const input = screen.getByTestId(
            "backup-file-input",
        ) as HTMLInputElement;
        const bad = new File(['{"format":"not-ours"}'], "evil.json", {
            type: "application/json",
        });
        await act(async () => {
            fireEvent.change(input, {target: {files: [bad]}});
        });
        // The comparison stats call must NOT fire when format
        // validation fails.
        await waitFor(() => {
            expect(statsSpy).not.toHaveBeenCalled();
        });
        expect(screen.queryByTestId("backup-comparison")).toBeNull();
    });

    it("Cancel dismisses the comparison without firing import", async () => {
        vi.spyOn(getStorage().backup, "stats").mockResolvedValue({
            user_id: SEED_USER_ID,
            total_records: 0,
            tables: {},
        });
        const importSpy = vi.spyOn(getStorage().backup, "import");

        renderSection();
        const input = screen.getByTestId(
            "backup-file-input",
        ) as HTMLInputElement;
        const file = new File([JSON.stringify(samplePayload)], "backup.json", {
            type: "application/json",
        });
        await act(async () => {
            fireEvent.change(input, {target: {files: [file]}});
        });
        await waitFor(() => {
            expect(screen.getByTestId("backup-comparison")).toBeInTheDocument();
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId("backup-cancel"));
        });

        expect(importSpy).not.toHaveBeenCalled();
        expect(screen.queryByTestId("backup-comparison")).toBeNull();
    });

    // --- v1.12.0 / Phase 25C: pre-restore diff preview --------------

    it("renders the diff preview above the confirm button when restoring", async () => {
        const currentSnapshot: BackupPayload = {
            ...samplePayload,
            created_at: "2026-05-10T10:00:00.000Z",
            data: {
                learning_projects: [
                    {
                        id: "p1",
                        topic: "Old topic",
                        daily_minutes: 30,
                        updated_at: "2026-05-10",
                    },
                ],
            },
        };
        const incomingPayload: BackupPayload = {
            ...samplePayload,
            created_at: "2026-05-18T10:00:00.000Z",
            data: {
                learning_projects: [
                    {
                        id: "p1",
                        topic: "Old topic",
                        daily_minutes: 45,
                        updated_at: "2026-05-18",
                    },
                    {
                        id: "p2",
                        topic: "New project",
                        daily_minutes: 20,
                        updated_at: "2026-05-18",
                    },
                ],
            },
        };
        vi.spyOn(getStorage().backup, "stats").mockResolvedValue({
            user_id: SEED_USER_ID,
            total_records: 1,
            tables: {learning_projects: 1},
        });
        vi.spyOn(getStorage().backup, "export").mockResolvedValue(currentSnapshot);

        renderSection();
        const input = screen.getByTestId("backup-file-input") as HTMLInputElement;
        const file = new File([JSON.stringify(incomingPayload)], "backup.json", {
            type: "application/json",
        });
        await act(async () => {
            fireEvent.change(input, {target: {files: [file]}});
        });

        // The diff preview surface (BackupCompare) renders, showing
        // 1 added (p2) and 1 changed (p1.daily_minutes).
        await waitFor(() => {
            expect(screen.getByTestId("backup-compare")).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByTestId("totals-added").textContent).toBe("+1");
        });
        expect(screen.getByTestId("totals-changed").textContent).toBe("~1");

        // The Restore button picks up the dynamic counts.
        const confirm = screen.getByTestId(
            "backup-confirm",
        ) as HTMLButtonElement;
        await waitFor(() => {
            expect(confirm.textContent).toMatch(/1 added/);
            expect(confirm.textContent).toMatch(/1 updated/);
        });
    });

    it("declines a non-Adaptive-Learner file with a gentle warning, not an error (#640)", async () => {
        vi.mocked(notify.warning).mockClear();
        vi.mocked(notify.error).mockClear();
        renderSection();
        const input = screen.getByTestId(
            "backup-file-input",
        ) as HTMLInputElement;
        // Valid JSON, but the ``format`` marker is not ours (e.g. a
        // backup from another app).
        const foreign = new File(
            [JSON.stringify({format: "something-else", version: "1.0.0", data: {}})],
            "foreign.json",
            {type: "application/json"},
        );
        await act(async () => {
            fireEvent.change(input, {target: {files: [foreign]}});
        });

        // Gentle warning (no "Report Issue"), NOT an error toast, and no
        // restore preview opens.
        await waitFor(() => expect(vi.mocked(notify.warning)).toHaveBeenCalled());
        expect(vi.mocked(notify.error)).not.toHaveBeenCalled();
        expect(screen.queryByTestId("backup-compare")).not.toBeInTheDocument();
    });
});
