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

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TestFeatureProvider } from "../../../features/testFeatureProvider";
import { I18nProvider } from "../../../hooks/ui/useI18n";
import { _resetDbForTests, getDb } from "../../../storage/dexie/db";
import { _resetStorageCacheForTests, getStorage } from "../../../storage";
import type { StorageMode } from "../../../storage/types";

import LearningRepoSettingsSection from "./LearningRepoSettingsSection";

vi.mock("../../../utils/notify", () => ({
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
  const { IDBFactory } = await import("fake-indexeddb");
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

afterEach(async () => {
  await _resetDbForTests();
  localStorage.clear();
  vi.restoreAllMocks();
});

function renderSection(mode: StorageMode = "dexie") {
  return render(
    <TestFeatureProvider context={{ mode }}>
      <I18nProvider>
        <LearningRepoSettingsSection />
      </I18nProvider>
    </TestFeatureProvider>,
  );
}

describe("LearningRepoSettingsSection — Dexie mode", () => {
  it("renders the panel with the git toggle disabled + a desktop-only notice", async () => {
    renderSection();
    // The Dexie-unavailable panel is gone — it used to mount with
    // testid "learning-repo-settings-dexie-unavailable". The full
    // settings UI mounts; the git toggle stays VISIBLE but disabled:
    // git persistence needs a server-side filesystem + git binary,
    // so LEARNING_REPO_GIT is disabled in Dexie mode with an
    // explanation naming the desktop app (#335: never hidden).
    await waitFor(() => {
      expect(screen.getByTestId("learning-repo-settings")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("learning-repo-settings-dexie-unavailable")).toBeNull();
    const toggle = screen.getByTestId("learning-repo-settings-enable-git") as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(screen.getByTestId("learning-repo-git-desktop-only")).toBeInTheDocument();
    expect(screen.getByTestId("learning-repo-settings-repos-dir")).toBeInTheDocument();
    expect(screen.getByTestId("learning-repo-settings-save")).toBeInTheDocument();
  });

  it("loads the bundled repos-dir default and persists an edit to Dexie", async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByTestId("learning-repo-settings")).toBeInTheDocument();
    });
    const reposDir = screen.getByTestId("learning-repo-settings-repos-dir") as HTMLInputElement;
    // The drift-pin in plugin-config-sync.test.ts proves the bundled
    // default repos_dir=~/.local/share/adaptive_learner/repos.
    expect(reposDir.value).toBe("~/.local/share/adaptive_learner/repos");

    await act(async () => {
      fireEvent.change(reposDir, { target: { value: "/my/custom/dir" } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("learning-repo-settings-save"));
    });

    // Read back through the storage abstraction + Dexie directly.
    const fresh = await getStorage().pluginSettings.get("learning-repo");
    expect(fresh.settings.repos_dir).toBe("/my/custom/dir");
    const row = await getDb().pluginSettings.get("learning-repo");
    expect(row).toBeTruthy();
    expect(row?.settings).toMatchObject({ repos_dir: "/my/custom/dir" });
  });
});

describe("LearningRepoSettingsSection — git toggle (API mode)", () => {
  // The feature context is independent of the storage backing: here
  // the GIT_PERSIST/LEARNING_REPO_GIT gate is active (API mode) so the
  // toggle renders, while persistence still runs through the Dexie
  // storage seeded in beforeEach.
  it("loads the bundled enable_git=false default", async () => {
    renderSection("api");
    await waitFor(() => {
      expect(screen.getByTestId("learning-repo-settings")).toBeInTheDocument();
    });
    const checkbox = screen.getByTestId("learning-repo-settings-enable-git") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(false);
    expect(screen.queryByTestId("learning-repo-git-desktop-only")).toBeNull();
  });

  it("saves the toggled enable_git into the pluginSettings row", async () => {
    renderSection("api");
    await waitFor(() => {
      expect(screen.getByTestId("learning-repo-settings")).toBeInTheDocument();
    });
    const checkbox = screen.getByTestId("learning-repo-settings-enable-git") as HTMLInputElement;

    await act(async () => {
      fireEvent.click(checkbox);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("learning-repo-settings-save"));
    });

    const fresh = await getStorage().pluginSettings.get("learning-repo");
    expect(fresh.settings.enable_git).toBe(true);
    const row = await getDb().pluginSettings.get("learning-repo");
    expect(row?.settings).toMatchObject({ enable_git: true });
  });
});

describe("LearningRepoSettingsSection — card container", () => {
  // #1017-follow-up: the section must sit in the same ``settings-section``
  // card as its neighbours (Gamification above it in the Plugins tab), not
  // float on the page background. Heading uses the shared card-title class.
  it("renders inside a settings-section card with a settings-section-title", async () => {
    renderSection("api");
    const section = await screen.findByTestId("learning-repo-settings");
    expect(section.classList.contains("settings-section")).toBe(true);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.classList.contains("settings-section-title")).toBe(true);
  });
});
