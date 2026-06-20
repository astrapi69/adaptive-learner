/**
 * C5 — full-pipeline language consistency (v1.54.0).
 *
 * Pins that the language pair set at IMPORT time survives every step of
 * the data path: import -> (analysis) -> save-as-lesson -> content set
 * that the share wizard reads. Exercised through the real DexieStorage
 * layer (the GH-Pages path) so the contract holds end-to-end without UI.
 */

import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _resetDbForTests } from "./db/db";
import { dexieStorage } from "./db/dexie-storage";
import type { ContentLesson } from "./types";

beforeEach(async () => {
  await _resetDbForTests();
  const { IDBFactory } = await import("fake-indexeddb");
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB =
    new IDBFactory();
});

afterEach(async () => {
  await _resetDbForTests();
});

function lesson(): ContentLesson {
  return {
    id: "01-lektion",
    title: "Lektion",
    estimated_minutes: 10,
    cards: [{ id: "c1", front: "Bonjour", back: "Guten Tag", tags: [] }],
    steps: [{ id: "intro", type: "theory", body: "Theorie" }],
  };
}

describe("language pipeline consistency (import -> save -> set)", () => {
  it("the import-time pair survives into the saved content set", async () => {
    const user = await dexieStorage.users.create({ name: "A", language: "de" });

    // IMPORT — languages captured up front (German speaker learning French).
    const conv = await dexieStorage.imports.create(user.id, {
      source: "manual",
      title: "Französisch",
      source_language: "de",
      target_language: "fr",
      messages: [
        { role: "user", content: "Bonjour, merci, passé composé" },
        { role: "assistant", content: "oui" },
      ],
    });
    const got = await dexieStorage.imports.get(conv.id);
    expect(got.source_language).toBe("de");
    expect(got.target_language).toBe("fr");

    // SAVE-AS-LESSON — inherits the pair (the modal would pass these).
    const entry = await dexieStorage.contentLoader.saveUserSet({
      set_id: `analysis-${conv.id}`,
      title: "Französisch",
      title_native: "Français",
      language: got.target_language ?? "fr",
      target_language: got.target_language ?? "fr",
      source_language: got.source_language ?? "de",
      level: "A1",
      origin: "analysis",
      lessons: [lesson()],
    });
    expect(entry.source_language).toBe("de");
    expect(entry.target_language).toBe("fr");

    // SHARE reads the cached set — the pair the wizard inherits.
    const listed = await dexieStorage.contentLoader.listSets();
    const mine = listed.sets.find((s) => s.id === entry.id);
    expect(mine?.source_language).toBe("de");
    expect(mine?.target_language).toBe("fr");
  });

  it("old imports without a pair round-trip as null (fallback territory)", async () => {
    const user = await dexieStorage.users.create({ name: "B", language: "de" });
    const conv = await dexieStorage.imports.create(user.id, {
      source: "manual",
      title: "Alt",
      messages: [{ role: "user", content: "x" }],
    });
    const got = await dexieStorage.imports.get(conv.id);
    expect(got.source_language ?? null).toBeNull();
    expect(got.target_language ?? null).toBeNull();
  });
});
