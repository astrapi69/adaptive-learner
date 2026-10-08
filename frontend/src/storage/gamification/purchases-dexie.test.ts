/**
 * Browser-mode XP purchase ledger (#3445), the Dexie half of
 * ``backend/tests/test_xp_purchase_ledger.py``.
 *
 * A purchase is one event: the XP deduction and the ``xpPurchases`` row are
 * written in one transaction, and ownership is derived from the rows.
 */

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { purchaseId } from "../../lib/gamification/purchase-id";
import { _resetDbForTests, getDb } from "../dexie/db";
import { awardXPFlat, getXPState } from "./gamification";
import { listPurchasesDexie, purchaseItemDexie } from "./purchases-dexie";

const USER = "user-1";

beforeEach(async () => {
  await _resetDbForTests();
  const { IDBFactory } = await import("fake-indexeddb");
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  // The factory swap alone does not always drop Dexie's previous backing
  // store under happy-dom (sync-engine.test.ts), so clear what these tests write.
  await Promise.all([getDb().userXp.clear(), getDb().xpPurchases.clear()]);
});

async function withXp(amount: number): Promise<void> {
  await awardXPFlat(USER, amount, "test");
}

describe("purchaseItemDexie (#3445)", () => {
  it("deducts the cost and records the purchase in one event", async () => {
    await withXp(400);
    const result = await purchaseItemDexie(USER, {
      item_kind: "avatar_frame",
      item_id: "star",
      cost: 150,
    });
    expect(result.xp.total_xp).toBe(250);
    expect(result.purchase.id).toBe(await purchaseId(USER, "avatar_frame", "star"));
    const rows = await getDb().xpPurchases.where({ user_id: USER }).toArray();
    expect(rows.map((r) => [r.item_kind, r.item_id, r.cost])).toEqual([
      ["avatar_frame", "star", 150],
    ]);
  });

  it("charges a repeated purchase once", async () => {
    await withXp(400);
    const body = { item_kind: "avatar_frame", item_id: "star", cost: 150 } as const;
    await purchaseItemDexie(USER, body);
    const again = await purchaseItemDexie(USER, body);
    expect(again.xp.total_xp).toBe(250);
    expect(await getDb().xpPurchases.count()).toBe(1);
  });

  it.each([
    ["one below the cost", 149, false],
    ["exactly the cost", 150, true],
  ] as const)("affordability boundary: %s", async (_label, balance, succeeds) => {
    await withXp(balance);
    const attempt = purchaseItemDexie(USER, {
      item_kind: "avatar_frame",
      item_id: "star",
      cost: 150,
    });
    if (succeeds) {
      await expect(attempt).resolves.toMatchObject({ xp: { total_xp: 0 } });
    } else {
      await expect(attempt).rejects.toMatchObject({ status: 400 });
      expect((await getXPState(USER)).total_xp).toBe(balance);
    }
    expect(await getDb().xpPurchases.count()).toBe(succeeds ? 1 : 0);
  });

  it("rejects a purchase with no XP row at all and writes nothing", async () => {
    await expect(
      purchaseItemDexie(USER, { item_kind: "arcade_game", item_id: "snake", cost: 100 }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await getDb().xpPurchases.count()).toBe(0);
  });

  it("records an already-paid item without charging, once", async () => {
    await withXp(100);
    const body = {
      item_kind: "mascot_variant",
      item_id: "gold",
      cost: 250,
      already_paid: true,
    } as const;
    await purchaseItemDexie(USER, body);
    const again = await purchaseItemDexie(USER, body);
    expect(again.xp.total_xp).toBe(100);
    expect(await getDb().xpPurchases.count()).toBe(1);
  });

  it.each([
    ["an unknown kind", { item_kind: "spaceship", item_id: "x", cost: 10 }],
    ["a negative cost", { item_kind: "avatar_frame", item_id: "star", cost: -1 }],
  ])("rejects %s", async (_label, body) => {
    await withXp(400);
    await expect(
      purchaseItemDexie(USER, body as Parameters<typeof purchaseItemDexie>[1]),
    ).rejects.toMatchObject({ status: 400 });
    expect(await getDb().xpPurchases.count()).toBe(0);
  });

  it("lists only the given user's purchases", async () => {
    await withXp(1000);
    await awardXPFlat("user-2", 1000, "test");
    await purchaseItemDexie(USER, { item_kind: "avatar_frame", item_id: "star", cost: 150 });
    await purchaseItemDexie(USER, { item_kind: "arcade_game", item_id: "snake", cost: 100 });
    await purchaseItemDexie("user-2", { item_kind: "avatar_frame", item_id: "accent", cost: 300 });
    const listed = await listPurchasesDexie(USER);
    expect(listed.map((p) => p.item_id).sort()).toEqual(["snake", "star"]);
  });
});
