/**
 * DangerZoneSection tests (Phase 41F).
 *
 * Covers the three-step typed-confirm flow, the exact-match
 * requirement on the confirmation token, the backup-offer
 * affordance, and the post-reset redirect + localStorage clear.
 *
 * Mocks the storage layer so neither the API roundtrip nor the
 * Dexie IndexedDB connection runs during these tests; that
 * coverage lives in api-storage.test.ts + dexie-storage.test.ts
 * (and the backend's test_reset_service.py for the 400 gate).
 */

import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import DangerZoneSection from "./DangerZoneSection";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

const storageReset = vi.fn();
const storageBackupExport = vi.fn();
vi.mock("../storage", async () => {
    const actual = await vi.importActual<typeof import("../storage")>(
        "../storage",
    );
    return {
        ...actual,
        getStorage: () => ({
            reset: (token: string) => storageReset(token),
            backup: {export: (userId: string) => storageBackupExport(userId)},
        }),
    };
});

const notifySuccess = vi.fn();
const notifyError = vi.fn();
vi.mock("../utils/notify", () => ({
    notify: {
        success: (...a: unknown[]) => notifySuccess(...a),
        error: (...a: unknown[]) => notifyError(...a),
        info: vi.fn(),
        warning: vi.fn(),
    },
}));

// Mock the save helper so the jsdom test environment doesn't try to
// create blobs / object URLs / open the OS save dialog. The Danger-Zone
// button now uses the SAME saveBackupToDisk helper as the Settings export
// (#331); the default resolves to a plain "download" outcome.
const saveBackupToDiskMock = vi.fn(async (..._a: unknown[]) => ({
    method: "download" as const,
    filename: "backup-u-backup.json",
}));
vi.mock("../utils/backup-download", () => ({
    saveBackupToDisk: (...a: unknown[]) => saveBackupToDiskMock(...a),
    backupFilename: (userId: string) => `backup-${userId}.json`,
}));

function renderDangerZone() {
    return render(
        <MemoryRouter>
            <DangerZoneSection />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    mockNavigate.mockClear();
    storageReset.mockReset();
    storageBackupExport.mockReset();
    notifySuccess.mockClear();
    notifyError.mockClear();
    saveBackupToDiskMock.mockClear();
    localStorage.clear();
    sessionStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("DangerZoneSection", () => {
    it("renders the backup offer + Reset button in idle state", () => {
        renderDangerZone();
        expect(
            screen.getByTestId("danger-zone-backup-offer"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("danger-zone-reset-btn"),
        ).toBeInTheDocument();
        // No modal yet.
        expect(screen.queryByTestId("danger-zone-modal")).toBeNull();
    });

    it("clicking Reset opens the confirm modal (step 2)", () => {
        renderDangerZone();
        fireEvent.click(screen.getByTestId("danger-zone-reset-btn"));
        expect(screen.getByTestId("danger-zone-modal")).toBeInTheDocument();
        expect(screen.getByTestId("danger-zone-warning")).toBeInTheDocument();
        expect(screen.getByTestId("danger-zone-continue")).toBeInTheDocument();
        // No typed-input yet.
        expect(screen.queryByTestId("danger-zone-typed-input")).toBeNull();
    });

    it("Cancel from confirm modal returns to idle", () => {
        renderDangerZone();
        fireEvent.click(screen.getByTestId("danger-zone-reset-btn"));
        fireEvent.click(screen.getByTestId("danger-zone-cancel"));
        expect(screen.queryByTestId("danger-zone-modal")).toBeNull();
        expect(
            screen.getByTestId("danger-zone-reset-btn"),
        ).toBeInTheDocument();
    });

    it("Continue swaps to typed-confirm pane with disabled final button", () => {
        renderDangerZone();
        fireEvent.click(screen.getByTestId("danger-zone-reset-btn"));
        fireEvent.click(screen.getByTestId("danger-zone-continue"));
        const finalBtn = screen.getByTestId("danger-zone-final-btn");
        expect(finalBtn).toBeDisabled();
        // Input is present and empty.
        const input = screen.getByTestId(
            "danger-zone-typed-input",
        ) as HTMLInputElement;
        expect(input.value).toBe("");
    });

    it("lowercase 'reset' leaves the final button disabled", () => {
        renderDangerZone();
        fireEvent.click(screen.getByTestId("danger-zone-reset-btn"));
        fireEvent.click(screen.getByTestId("danger-zone-continue"));
        const input = screen.getByTestId("danger-zone-typed-input");
        fireEvent.change(input, {target: {value: "reset"}});
        expect(screen.getByTestId("danger-zone-final-btn")).toBeDisabled();
    });

    it("partial 'RESE' leaves the final button disabled", () => {
        renderDangerZone();
        fireEvent.click(screen.getByTestId("danger-zone-reset-btn"));
        fireEvent.click(screen.getByTestId("danger-zone-continue"));
        const input = screen.getByTestId("danger-zone-typed-input");
        fireEvent.change(input, {target: {value: "RESE"}});
        expect(screen.getByTestId("danger-zone-final-btn")).toBeDisabled();
    });

    it("trailing whitespace 'RESET ' leaves the final button disabled", () => {
        renderDangerZone();
        fireEvent.click(screen.getByTestId("danger-zone-reset-btn"));
        fireEvent.click(screen.getByTestId("danger-zone-continue"));
        const input = screen.getByTestId("danger-zone-typed-input");
        fireEvent.change(input, {target: {value: "RESET "}});
        expect(screen.getByTestId("danger-zone-final-btn")).toBeDisabled();
    });

    it("exact 'RESET' enables the final button + clicking it runs the reset flow", async () => {
        storageReset.mockResolvedValue({reset: true, tables_cleared: 25});
        // Seed localStorage so the post-reset clear has something
        // observable to remove.
        localStorage.setItem("adaptive-learner.user_id", "u-1");
        localStorage.setItem("adaptive-learner.project_id", "p-1");

        renderDangerZone();
        fireEvent.click(screen.getByTestId("danger-zone-reset-btn"));
        fireEvent.click(screen.getByTestId("danger-zone-continue"));
        const input = screen.getByTestId("danger-zone-typed-input");
        fireEvent.change(input, {target: {value: "RESET"}});
        const finalBtn = screen.getByTestId("danger-zone-final-btn");
        expect(finalBtn).not.toBeDisabled();

        fireEvent.click(finalBtn);
        await waitFor(() => {
            expect(storageReset).toHaveBeenCalledWith("RESET");
        });
        // Browser-key stores are wiped by the component (not the
        // storage layer) - confirm the user_id + project_id are
        // gone after a successful reset.
        await waitFor(() => {
            expect(localStorage.getItem("adaptive-learner.user_id")).toBeNull();
        });
        expect(localStorage.getItem("adaptive-learner.project_id")).toBeNull();
        // Redirect to Landing (not Dashboard - the user is now in
        // first-visit state).
        expect(mockNavigate).toHaveBeenCalledWith("/", {replace: true});
        expect(notifySuccess).toHaveBeenCalled();
    });

    it("reset failure shows error toast + preserves localStorage", async () => {
        const {ApiError} = await import("../api/client");
        storageReset.mockRejectedValue(new ApiError(500, "DB down"));
        localStorage.setItem("adaptive-learner.user_id", "u-keep");

        renderDangerZone();
        fireEvent.click(screen.getByTestId("danger-zone-reset-btn"));
        fireEvent.click(screen.getByTestId("danger-zone-continue"));
        const input = screen.getByTestId("danger-zone-typed-input");
        fireEvent.change(input, {target: {value: "RESET"}});
        fireEvent.click(screen.getByTestId("danger-zone-final-btn"));

        await waitFor(() => {
            expect(notifyError).toHaveBeenCalled();
        });
        // localStorage stays — the reset never landed.
        expect(localStorage.getItem("adaptive-learner.user_id")).toBe("u-keep");
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("backup offer button saves via storage.backup.export + saveBackupToDisk", async () => {
        localStorage.setItem("adaptive-learner.user_id", "u-backup");
        storageBackupExport.mockResolvedValue({
            stats: {total_records: 42},
        });
        renderDangerZone();
        fireEvent.click(screen.getByTestId("danger-zone-backup-btn"));
        await waitFor(() => {
            expect(storageBackupExport).toHaveBeenCalledWith("u-backup");
        });
        expect(saveBackupToDiskMock).toHaveBeenCalled();
        expect(notifySuccess).toHaveBeenCalled();
    });

    it("backup offer with no active user shows error toast", async () => {
        renderDangerZone();
        fireEvent.click(screen.getByTestId("danger-zone-backup-btn"));
        await waitFor(() => {
            expect(notifyError).toHaveBeenCalled();
        });
        expect(storageBackupExport).not.toHaveBeenCalled();
    });
});
