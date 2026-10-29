/**
 * Ownership of XP-bought items follows the purchase ledger (#3445).
 *
 * Before the ledger, ownership lived only in a localStorage list while the
 * XP deduction rode sync and backup. ``reconcilePurchases`` closes the gap in
 * both directions on every gallery load: ledger rows a device has not seen
 * (another browser, cleared site data, a LAN sync) become owned locally, and
 * local purchases from before the ledger are recorded once as already paid.
 */

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { _resetDbForTests, getDb } from "../../storage/dexie/db";
import { dexieGamification } from "../../storage/gamification/dexie-gamification";
import { awardXPFlat, getXPState } from "../../storage/gamification/gamification";
import { purchaseItemDexie } from "../../storage/gamification/purchases-dexie";
import type { IGamificationNamespace } from "../../storage/types/learning/gamification";
import { reconcilePurchases, type PurchaseSurface } from "./purchase-ledger";
import { createSelectionStore } from "./selection-store";

const USER = "user-1";
const COSTS: Record<string, number> = { star: 150, accent: 300 };

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

function frameSurface(storage: Storage): PurchaseSurface {
  return {
    kind: "avatar_frame",
    store: createSelectionStore("adaptive-learner.test.frames", "none"),
    costOf: (id) => COSTS[id],
    storage,
  };
}

beforeEach(async () => {
  await _resetDbForTests();
  const { IDBFactory } = await import("fake-indexeddb");
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  // The factory swap alone does not always drop Dexie's previous backing
  // store under happy-dom (sync-engine.test.ts), so clear what these tests write.
  await Promise.all([getDb().userXp.clear(), getDb().xpPurchases.clear()]);
});

describe("reconcilePurchases (#3445)", () => {
  it("owns a ledger purchase this device has not seen (second browser, LAN sync)", async () => {
    await awardXPFlat(USER, 400, "test");
    await purchaseItemDexie(USER, { item_kind: "avatar_frame", item_id: "star", cost: 150 });
    const freshDevice = frameSurface(memoryStorage());

    const owned = await reconcilePurchases(USER, freshDevice, dexieGamification);

    expect(owned).toEqual(["star"]);
    expect(freshDevice.store.read(USER, freshDevice.storage).purchased).toEqual(["star"]);
  });

  it("records a pre-ledger local purchase exactly once, without charging again", async () => {
    await awardXPFlat(USER, 100, "test");
    const surface = frameSurface(memoryStorage());
    surface.store.addPurchased(USER, "accent", surface.storage);

    await reconcilePurchases(USER, surface, dexieGamification);
    await reconcilePurchases(USER, surface, dexieGamification);

    const rows = await getDb().xpPurchases.toArray();
    expect(rows.map((r) => [r.item_kind, r.item_id, r.cost])).toEqual([
      ["avatar_frame", "accent", 300],
    ]);
    expect((await getXPState(USER)).total_xp).toBe(100);
  });

  it("does not migrate a local id the catalog does not sell", async () => {
    const surface = frameSurface(memoryStorage());
    surface.store.addPurchased(USER, "retired-frame", surface.storage);

    const owned = await reconcilePurchases(USER, surface, dexieGamification);

    expect(await getDb().xpPurchases.count()).toBe(0);
    expect(owned).toEqual(["retired-frame"]);
  });

  it("ignores ledger rows of another kind", async () => {
    await awardXPFlat(USER, 400, "test");
    await purchaseItemDexie(USER, { item_kind: "arcade_game", item_id: "snake", cost: 100 });
    const surface = frameSurface(memoryStorage());

    expect(await reconcilePurchases(USER, surface, dexieGamification)).toEqual([]);
  });

  it("keeps local ownership when the ledger cannot be read", async () => {
    const surface = frameSurface(memoryStorage());
    surface.store.addPurchased(USER, "star", surface.storage);
    const failing = {
      listPurchases: vi.fn().mockRejectedValue(new Error("offline")),
      purchaseItem: vi.fn(),
    } as unknown as IGamificationNamespace;

    expect(await reconcilePurchases(USER, surface, failing)).toEqual(["star"]);
    expect(failing.purchaseItem).not.toHaveBeenCalled();
  });
});
