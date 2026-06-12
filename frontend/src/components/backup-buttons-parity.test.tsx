/**
 * Backup-button parity regression test (#331).
 *
 * Two buttons export a backup:
 *   - Settings > Daten > "Sicherung erstellen"  (BackupSection, `backup-export`)
 *   - Danger Zone > "Backup erstellen"           (DangerZoneSection, `danger-zone-backup-btn`)
 *
 * They MUST produce the identical file. Before #331 they diverged on the
 * save path (BackupSection used `saveBackupToDisk`, DangerZone used the
 * lower-level `triggerBackupDownload`), so the two buttons behaved
 * differently. This test pins that both funnel the SAME exported payload
 * through the SAME save helper (`saveBackupToDisk`) and never through the
 * divergent `triggerBackupDownload` path -- if one button is ever rewired
 * to a different download path, this fails.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";

import BackupSection from "./BackupSection";
import DangerZoneSection from "./DangerZoneSection";
import {setUserId} from "../lib/learnerState";
import type {BackupPayload} from "../types/domain";

vi.mock("react-router-dom", async () => {
    const actual =
        await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return {...actual, useNavigate: () => vi.fn()};
});

vi.mock("../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

// Spy on BOTH save helpers. The parity guarantee is: both buttons call
// saveBackupToDisk (the shared path) and neither calls triggerBackupDownload.
const saveBackupToDiskMock = vi.fn(async (..._a: unknown[]) => ({
    method: "download" as const,
    filename: "adaptive-learner-backup-test.json",
}));
const triggerBackupDownloadMock = vi.fn();
vi.mock("../utils/backup-download", () => ({
    saveBackupToDisk: (...a: unknown[]) => saveBackupToDiskMock(...a),
    triggerBackupDownload: (...a: unknown[]) => triggerBackupDownloadMock(...a),
    backupFilename: (userId: string) => `adaptive-learner-backup-${userId}.json`,
}));

const SEED_USER_ID = "user-parity-001";

// The single source of truth both buttons export. Whatever the endpoint
// returns, both buttons must hand THIS object to the save helper unchanged.
const samplePayload: BackupPayload = {
    format: "adaptive-learner-backup",
    version: "1.3.0",
    app_version: "test",
    created_at: "2026-06-12T00:00:00.000Z",
    user_id: SEED_USER_ID,
    storage_mode: "api",
    data: {users: [], learning_projects: []},
    stats: {total_records: 7, tables: {users: 1, learning_projects: 6}},
};

const exportMock = vi.fn(async (..._a: unknown[]) => samplePayload);
vi.mock("../storage", async () => {
    const actual = await vi.importActual<typeof import("../storage")>("../storage");
    return {
        ...actual,
        getStorage: () => ({
            reset: vi.fn(),
            backup: {
                export: (userId: string) => exportMock(userId),
                stats: async () => ({
                    user_id: SEED_USER_ID,
                    total_records: 7,
                    tables: {},
                }),
                import: vi.fn(),
            },
        }),
    };
});

// BackupSection touches the auto-backup module on mount (Dexie-only path,
// skipped in API mode, but the import must still resolve without IndexedDB).
vi.mock("../storage/auto-backup", () => ({
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

function wrap(node: React.ReactNode) {
    // No I18nProvider on purpose: useI18n falls back to the literal
    // strings, which is enough here (we assert on payload + save path,
    // not translated text) and avoids the provider's async catalog load.
    return render(<MemoryRouter>{node}</MemoryRouter>);
}

beforeEach(() => {
    localStorage.clear();
    setUserId(SEED_USER_ID);
    saveBackupToDiskMock.mockClear();
    triggerBackupDownloadMock.mockClear();
    exportMock.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("backup-button parity (#331)", () => {
    it("both backup buttons produce identical output via the same save helper", async () => {
        // "Sicherung erstellen" (Settings > Daten).
        const settings = wrap(<BackupSection />);
        fireEvent.click(screen.getByTestId("backup-export"));
        await waitFor(() => expect(saveBackupToDiskMock).toHaveBeenCalledTimes(1));
        const settingsCall = saveBackupToDiskMock.mock.calls[0];
        settings.unmount();

        // "Backup erstellen" (Danger Zone).
        wrap(<DangerZoneSection />);
        fireEvent.click(screen.getByTestId("danger-zone-backup-btn"));
        await waitFor(() => expect(saveBackupToDiskMock).toHaveBeenCalledTimes(2));
        const dangerCall = saveBackupToDiskMock.mock.calls[1];

        // Identical OUTPUT: same payload (byte-for-byte) + same filename.
        const [settingsPayload, settingsFilename] = settingsCall;
        const [dangerPayload, dangerFilename] = dangerCall;
        expect(JSON.stringify(dangerPayload)).toBe(JSON.stringify(settingsPayload));
        expect(dangerFilename).toBe(settingsFilename);

        // Neither button uses the divergent low-level download path.
        expect(triggerBackupDownloadMock).not.toHaveBeenCalled();
    });
});
