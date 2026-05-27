/**
 * LearningRepoSettingsSection — Dexie-mode round-trip
 * (Phase 49G / v1.32.0 / PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Pre-49G: this component returned a "feature only available
 * in server mode" panel in Dexie mode. After 49G it routes
 * through ``storage.pluginSettings`` which works in both
 * modes (49A) — Dexie reads the bundled YAML defaults on the
 * first ``get``, then upserts an IndexedDB row on save.
 *
 * Pin the new contract: rendering in Dexie mode produces the
 * full settings UI (toggle + text input + save button), the
 * initial values come from the bundled defaults, and saving
 * persists to the IndexedDB row that ``get`` reads back.
 */

import "fake-indexeddb/auto";

import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {I18nProvider} from "../hooks/useI18n";
import {_resetDbForTests, getDb} from "../storage/db";
import {_resetStorageCacheForTests, getStorage} from "../storage";

import LearningRepoSettingsSection from "./LearningRepoSettingsSection";

vi.mock("../utils/notify", () => ({
    notify: {
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    },
}));

beforeEach(async () => {
    localStorage.setItem("adaptive-learner.storage_mode", "dexie");
    _resetStorageCacheForTests();
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

afterEach(async () => {
    await _resetDbForTests();
    localStorage.clear();
    vi.restoreAllMocks();
});

function renderSection() {
    return render(
        <I18nProvider>
            <LearningRepoSettingsSection />
        </I18nProvider>,
    );
}

describe("LearningRepoSettingsSection — Dexie mode", () => {
    it("renders the full settings panel (not the unavailable message)", async () => {
        renderSection();
        // The Dexie-unavailable panel is gone — it used to
        // mount with testid "learning-repo-settings-dexie-
        // unavailable". The full settings UI must mount
        // instead, with the toggle + text + save controls.
        await waitFor(() => {
            expect(
                screen.getByTestId("learning-repo-settings"),
            ).toBeInTheDocument();
        });
        expect(
            screen.queryByTestId(
                "learning-repo-settings-dexie-unavailable",
            ),
        ).toBeNull();
        expect(
            screen.getByTestId("learning-repo-settings-enable-git"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("learning-repo-settings-repos-dir"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("learning-repo-settings-save"),
        ).toBeInTheDocument();
    });

    it("loads initial values from the bundled YAML defaults", async () => {
        renderSection();
        await waitFor(() => {
            expect(
                screen.getByTestId("learning-repo-settings"),
            ).toBeInTheDocument();
        });
        const checkbox = screen.getByTestId(
            "learning-repo-settings-enable-git",
        ) as HTMLInputElement;
        const reposDir = screen.getByTestId(
            "learning-repo-settings-repos-dir",
        ) as HTMLInputElement;
        // The drift-pin in plugin-config-sync.test.ts proves
        // the bundled defaults are enable_git=false +
        // repos_dir=~/.local/share/adaptive_learner/repos.
        expect(checkbox.checked).toBe(false);
        expect(reposDir.value).toBe(
            "~/.local/share/adaptive_learner/repos",
        );
    });

    it("saves user-edited values into the Dexie pluginSettings row", async () => {
        renderSection();
        await waitFor(() => {
            expect(
                screen.getByTestId("learning-repo-settings"),
            ).toBeInTheDocument();
        });
        const checkbox = screen.getByTestId(
            "learning-repo-settings-enable-git",
        ) as HTMLInputElement;
        const reposDir = screen.getByTestId(
            "learning-repo-settings-repos-dir",
        ) as HTMLInputElement;

        await act(async () => {
            fireEvent.click(checkbox);
            fireEvent.change(reposDir, {target: {value: "/my/custom/dir"}});
        });

        await act(async () => {
            fireEvent.click(
                screen.getByTestId("learning-repo-settings-save"),
            );
        });

        // Read back through the storage abstraction. Should
        // reflect the user's edits — the bundled defaults
        // are no longer used because the row exists.
        const fresh = await getStorage().pluginSettings.get(
            "learning-repo",
        );
        expect(fresh.settings.enable_git).toBe(true);
        expect(fresh.settings.repos_dir).toBe("/my/custom/dir");

        // Verify the row is in Dexie directly too (defensive
        // — ensures the save actually wrote to IndexedDB,
        // not just to in-memory state).
        const row = await getDb().pluginSettings.get("learning-repo");
        expect(row).toBeTruthy();
        expect(row?.settings).toMatchObject({
            enable_git: true,
            repos_dir: "/my/custom/dir",
        });
    });
});
