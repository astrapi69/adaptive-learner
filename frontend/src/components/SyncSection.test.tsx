/**
 * SyncSection tests (Phase 13B + 13F).
 *
 * The section has two unpaired variants (API vs Dexie mode) and
 * one paired view. We pin the rendered surface + the unpair
 * handler; the pair flow (which calls into SyncEngine.pair) is
 * covered by SyncEngine tests.
 */

import "fake-indexeddb/auto";

import {beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";

import SyncSection from "./SyncSection";
import {I18nProvider} from "../hooks/useI18n";
import {_resetStorageCacheForTests} from "../storage";
import {
    writeSyncConfig,
    writeLastSyncAt,
    appendSyncHistory,
} from "../storage/sync-engine";

vi.mock("../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

beforeEach(() => {
    localStorage.clear();
    _resetStorageCacheForTests();
});

function renderSection() {
    return render(
        <I18nProvider>
            <SyncSection />
        </I18nProvider>,
    );
}

describe("SyncSection — unpaired", () => {
    it("renders the API-mode desktop view by default (api storage mode)", () => {
        // Default storage mode is "api" (no localStorage flag set).
        renderSection();
        expect(screen.getByTestId("sync-desktop-unpaired")).toBeTruthy();
        expect(screen.getByTestId("sync-generate-button")).toBeTruthy();
        // Host input pre-filled to window.location.hostname / "localhost".
        const host = screen.getByTestId("sync-host-input") as HTMLInputElement;
        expect(host.value.length).toBeGreaterThan(0);
    });

    it("renders the Dexie-mode phone view when storage mode is dexie", () => {
        localStorage.setItem("adaptive-learner.storage_mode", "dexie");
        renderSection();
        expect(screen.getByTestId("sync-phone-unpaired")).toBeTruthy();
        expect(screen.getByTestId("sync-pair-input")).toBeTruthy();
        const button = screen.getByTestId("sync-pair-button") as HTMLButtonElement;
        // Disabled until the user pastes something.
        expect(button.disabled).toBe(true);
    });

    it("enables the connect button once a link is typed", () => {
        localStorage.setItem("adaptive-learner.storage_mode", "dexie");
        renderSection();
        const input = screen.getByTestId("sync-pair-input");
        fireEvent.change(input, {
            target: {value: "adaptive-learner://sync?host=h&port=18001&token=t"},
        });
        const button = screen.getByTestId("sync-pair-button") as HTMLButtonElement;
        expect(button.disabled).toBe(false);
    });
});

describe("SyncSection — paired", () => {
    function pair() {
        writeSyncConfig({
            host: "192.168.1.42",
            port: 18001,
            user_id: "u-aster",
            user_name: "Aster",
            paired_at: "2026-05-20T10:00:00.000Z",
        });
    }

    it("renders the paired card with Sync Now + Unpair", () => {
        pair();
        renderSection();
        expect(screen.getByTestId("sync-paired-view")).toBeTruthy();
        expect(screen.getByTestId("sync-now-button")).toBeTruthy();
        expect(screen.getByTestId("sync-unpair-button")).toBeTruthy();
        // Contains the host info.
        expect(screen.getByText(/192\.168\.1\.42/)).toBeTruthy();
    });

    it("shows 'never' when last_sync_at is unset", () => {
        pair();
        renderSection();
        const lastSync = screen.getByTestId("sync-last");
        expect(lastSync.textContent).toContain("never");
    });

    it("renders sync history when entries exist", () => {
        pair();
        writeLastSyncAt("2026-05-20T11:00:00.000Z");
        appendSyncHistory({
            at: "2026-05-20T10:00:00Z",
            success: true,
            pushed: 5,
            pulled: 3,
            conflicts: 0,
            summary: "pushed 5, pulled 3.",
        });
        appendSyncHistory({
            at: "2026-05-20T11:00:00Z",
            success: false,
            pushed: 0,
            pulled: 0,
            conflicts: 0,
            summary: "Network down.",
        });
        renderSection();
        const history = screen.getByTestId("sync-history");
        expect(history).toBeTruthy();
        expect(screen.getByTestId("sync-history-0")).toBeTruthy();
        expect(screen.getByTestId("sync-history-1")).toBeTruthy();
    });

    it("unpair confirmation flow clears the config", () => {
        pair();
        const originalConfirm = window.confirm;
        // happy-dom doesn't define ``window.confirm``; stub it.
        (window as unknown as {confirm: () => boolean}).confirm = () => true;
        renderSection();
        fireEvent.click(screen.getByTestId("sync-unpair-button"));
        // Section now renders the unpaired view.
        expect(screen.queryByTestId("sync-paired-view")).toBeNull();
        (window as unknown as {confirm: typeof window.confirm}).confirm =
            originalConfirm;
    });

    it("unpair cancel keeps the config", () => {
        pair();
        const originalConfirm = window.confirm;
        (window as unknown as {confirm: () => boolean}).confirm = () => false;
        renderSection();
        fireEvent.click(screen.getByTestId("sync-unpair-button"));
        expect(screen.getByTestId("sync-paired-view")).toBeTruthy();
        (window as unknown as {confirm: typeof window.confirm}).confirm =
            originalConfirm;
    });
});
