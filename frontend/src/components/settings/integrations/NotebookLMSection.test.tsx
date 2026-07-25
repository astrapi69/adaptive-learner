/**
 * NotebookLMSection (Lernmaterialien) — AI-key notice tests.
 *
 *   - #1835: the "API key required" notice on this view links to
 *     the AI settings tab (?tab=ai), where provider keys live —
 *     NOT the Integrations tab (GitHub).
 *   - #1836: after an AI-key import (which emits on the shared
 *     settings-refresh-bus), the notice disappears WITHOUT a
 *     reload, because ``useApiKeyStatus`` now reacts to the bus.
 *     Regression: it stays visible while genuinely keyless.
 */

import "fake-indexeddb/auto";

import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NotebookLMSection from "./NotebookLMSection";
import { ConfirmProvider } from "../../../contexts/ConfirmContext";
import {
  DerivedFeatureProvider,
  TestFeatureProvider,
} from "../../../features/testFeatureProvider";
import { I18nProvider } from "../../../hooks/ui/useI18n";
import { _resetApiKeyStatusCacheForTests } from "../../../hooks/settings/useApiKeyStatus";
import { setLanguage, setProjectId, setUserId } from "../../../lib/learning/learnerState";
import { emitSettingsRefresh } from "../../../lib/settings/settings-refresh-bus";
import { _resetStorageCacheForTests, getStorage, setPersistedStorageMode } from "../../../storage";
import { _resetDbForTests, getDb } from "../../../storage/dexie/db";

vi.mock("../../../utils/notify", () => ({
  notify: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

async function seedUser() {
  setPersistedStorageMode("dexie");
  _resetStorageCacheForTests();
  const storage = getStorage();
  const user = await storage.users.create({ name: "NotebookTester" });
  const project = await storage.users.projects.create(user.id, {
    topic: "Spanish",
    goal: "B1",
    timeframe: "3m",
    daily_minutes: 30,
  });
  setUserId(user.id);
  setProjectId(project.id);
  setLanguage("de");
  return { userId: user.id, projectId: project.id };
}

async function writeAnthropicKey(userId: string) {
  const db = getDb();
  const settings = await db.userSettings.where("user_id").equals(userId).first();
  if (settings) {
    await db.userSettings.put({ ...settings, api_key_anthropic: "test-key" });
  }
}

beforeEach(async () => {
  await _resetDbForTests();
  const { IDBFactory } = await import("fake-indexeddb");
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  localStorage.clear();
  _resetApiKeyStatusCacheForTests();
});

describe("NotebookLMSection AI-key notice", () => {
  it("no-key notice links to the AI settings tab, not Integrations (#1835)", async () => {
    const { projectId } = await seedUser();
    render(
      <MemoryRouter>
        <I18nProvider>
          <ConfirmProvider>
            <TestFeatureProvider context={{ mode: "dexie", hasAiKey: false }}>
              <NotebookLMSection projectId={projectId} />
            </TestFeatureProvider>
          </ConfirmProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    const link = await screen.findByTestId("api-key-required-link");
    expect(link.getAttribute("href")).toBe("/settings?tab=ai");
  });

  it("notice disappears after a key import emits on the settings-refresh-bus (#1836)", async () => {
    const { userId, projectId } = await seedUser();
    render(
      <MemoryRouter>
        <I18nProvider>
          <ConfirmProvider>
            <DerivedFeatureProvider>
              <NotebookLMSection projectId={projectId} />
            </DerivedFeatureProvider>
          </ConfirmProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    // Keyless: the notice is shown.
    await screen.findByTestId("api-key-required-notice");

    // The import path writes the key + emits on the bus.
    await writeAnthropicKey(userId);
    await act(async () => {
      emitSettingsRefresh();
      await Promise.resolve();
    });

    // The notice clears without a reload.
    await waitFor(() =>
      expect(screen.queryByTestId("api-key-required-notice")).toBeNull(),
    );
  });

  it("regression: the notice stays visible while genuinely keyless (#1836)", async () => {
    const { projectId } = await seedUser();
    render(
      <MemoryRouter>
        <I18nProvider>
          <ConfirmProvider>
            <DerivedFeatureProvider>
              <NotebookLMSection projectId={projectId} />
            </DerivedFeatureProvider>
          </ConfirmProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    await screen.findByTestId("api-key-required-notice");

    // A bus emit with no key written must NOT clear the notice.
    await act(async () => {
      emitSettingsRefresh();
      await Promise.resolve();
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId("api-key-required-notice")).not.toBeNull();
  });
});
