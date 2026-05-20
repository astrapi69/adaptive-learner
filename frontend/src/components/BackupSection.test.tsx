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
import {I18nProvider} from "../hooks/useI18n";
import {_resetStorageCacheForTests, getStorage} from "../storage";
import {setUserId} from "../lib/learnerState";
import type {BackupPayload} from "../types/domain";

vi.mock("../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn()},
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
        const statsSpy = vi.spyOn(getStorage().backup, "stats");
        renderSection();
        const input = screen.getByTestId(
            "backup-file-input",
        ) as HTMLInputElement;
        const bad = new File(['{"format":"not-ours"}'], "evil.json", {
            type: "application/json",
        });
        await act(async () => {
            fireEvent.change(input, {target: {files: [bad]}});
        });
        // The stats call must NOT fire when format validation fails.
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
});
