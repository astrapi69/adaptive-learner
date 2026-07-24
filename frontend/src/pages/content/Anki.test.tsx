/**
 * AnkiPage smoke tests (Phase 30C / v1.17.0).
 *
 * Run against the Dexie backend (storage_mode="dexie") so the
 * test exercises the real persistence path. The .apkg export
 * itself is not tested here — sql.js + WASM under Vitest is
 * heavy; the export's pure helpers + the buildApkg signature
 * live in ``lib/anki/apkg-builder.test.ts``, and the full
 * roundtrip is filed for a Playwright spec.
 */

import "fake-indexeddb/auto";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TestFeatureProvider } from "../../features/testFeatureProvider";
import { I18nProvider } from "../../hooks/ui/useI18n";
import { setLanguage, setProjectId, setUserId } from "../../lib/learning/learnerState";
import { _resetStorageCacheForTests, getStorage, setPersistedStorageMode } from "../../storage";
import { _resetDbForTests } from "../../storage/dexie/db";
import AnkiPage from "./Anki";

vi.mock("../../utils/notify", () => ({
  notify: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

async function seedUser() {
  setPersistedStorageMode("dexie");
  _resetStorageCacheForTests();
  const storage = getStorage();
  const user = await storage.users.create({ name: "AnkiTester" });
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

beforeEach(async () => {
  await _resetDbForTests();
  const { IDBFactory } = await import("fake-indexeddb");
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  localStorage.clear();
});

describe("AnkiPage", () => {
  it("renders the empty state when no cards exist", async () => {
    await seedUser();
    render(
      <MemoryRouter>
        <I18nProvider>
          <TestFeatureProvider>
            <AnkiPage />
          </TestFeatureProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("anki-empty")).toBeTruthy();
    });
    // Export button is disabled with no accepted cards.
    const btn = screen.getByTestId("anki-export-button");
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("lists cards + flips accepted on click", async () => {
    const { userId, projectId } = await seedUser();
    await getStorage().anki.create(userId, {
      card_type: "basic",
      front: "Hola",
      back: "Hello",
      project_id: projectId,
    });
    render(
      <MemoryRouter>
        <I18nProvider>
          <TestFeatureProvider>
            <AnkiPage />
          </TestFeatureProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("anki-card-list")).toBeTruthy();
    });
    const cards = screen.getAllByTestId(/^anki-card-[0-9a-f-]{36}$/);
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute("data-accepted")).toBe("false");

    // Find the Accept toggle button by data-testid pattern.
    const toggle = screen.getByTestId(
      `anki-toggle-${cards[0].getAttribute("data-testid")!.replace("anki-card-", "")}`,
    );
    fireEvent.click(toggle);
    await waitFor(() => {
      const refreshed = screen.getAllByTestId(/^anki-card-[0-9a-f-]{36}$/);
      expect(refreshed[0].getAttribute("data-accepted")).toBe("true");
    });

    // Export button is now enabled.
    const btn = screen.getByTestId("anki-export-button");
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  it("no-key notice links to the AI settings tab, not Integrations (#1835)", async () => {
    await seedUser();
    render(
      <MemoryRouter>
        <I18nProvider>
          <TestFeatureProvider context={{ mode: "dexie", hasAiKey: false }}>
            <AnkiPage />
          </TestFeatureProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    const link = await screen.findByTestId("api-key-required-link");
    expect(link.getAttribute("href")).toBe("/settings?tab=ai");
  });

  it("filters by accepted-only", async () => {
    const { userId, projectId } = await seedUser();
    await getStorage().anki.create(userId, {
      card_type: "basic",
      front: "Hola",
      back: "Hello",
      project_id: projectId,
      accepted: true,
    });
    await getStorage().anki.create(userId, {
      card_type: "basic",
      front: "Gato",
      back: "Cat",
      project_id: projectId,
    });
    render(
      <MemoryRouter>
        <I18nProvider>
          <TestFeatureProvider>
            <AnkiPage />
          </TestFeatureProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getAllByTestId(/^anki-card-[0-9a-f-]{36}$/)).toHaveLength(2);
    });
    // Toggle accepted-only.
    const filter = screen.getByTestId("anki-filter-accepted") as HTMLInputElement;
    fireEvent.click(filter);
    await waitFor(() => {
      expect(screen.getAllByTestId(/^anki-card-[0-9a-f-]{36}$/)).toHaveLength(1);
    });
  });
});
