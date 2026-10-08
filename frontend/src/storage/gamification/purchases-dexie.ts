/**
 * Browser-mode XP purchase ledger (#3445), the Dexie mirror of
 * ``adaptive_learner_gamification/purchases.py``.
 *
 * A purchase is one event: the ``userXp`` deduction and the
 * ``xpPurchases`` row are written in one ``rw`` transaction, so a failed
 * write leaves neither. The row id is computed BEFORE the transaction
 * opens: ``crypto.subtle`` is not an IndexedDB request, and awaiting it
 * inside the transaction would let it auto-commit.
 */

import { ApiError } from "../../api/client";
import { XP_PURCHASE_KINDS, purchaseId } from "../../lib/gamification/purchase-id";
import { getDb, nowIso } from "../dexie/db";
import type { XpPurchaseRow } from "../dexie/db";
import type {
  XpPurchaseInput,
  XpPurchaseRecord,
  XpPurchaseResult,
} from "../types/learning/gamification";
import { computeLevel, getXPState } from "./gamification";

function validate(input: XpPurchaseInput): number {
  if (!XP_PURCHASE_KINDS.includes(input.item_kind)) {
    throw new ApiError(400, `Unknown purchase kind '${input.item_kind}'`);
  }
  const price = Math.round(input.cost);
  if (!Number.isFinite(price) || price < 0) {
    throw new ApiError(400, `Purchase cost must not be negative, got ${input.cost}`);
  }
  return price;
}

async function deduct(userId: string, input: XpPurchaseInput, price: number): Promise<void> {
  const db = getDb();
  const xp = await db.userXp.where({ user_id: userId }).first();
  const balance = xp?.total_xp ?? 0;
  if (balance < price) {
    throw new ApiError(
      400,
      `Not enough XP for ${input.item_kind} '${input.item_id}': ${balance} < ${price}`,
    );
  }
  if (!xp || price === 0) return;
  await db.userXp.where({ user_id: userId }).modify((row) => {
    row.total_xp -= price;
    row.level = computeLevel(row.total_xp);
    row.updated_at = nowIso();
  });
}

/**
 * Record a purchase and deduct its cost in one transaction.
 *
 * @param userId - The buyer.
 * @param input - Kind, catalog id, price, and ``already_paid`` for the
 *   one-time migration of a pre-ledger purchase.
 * @returns The new XP state and the (existing or new) purchase row.
 * @throws ApiError(400) on an unknown kind, a negative cost, or a balance
 *   below the cost.
 *
 * @example
 * await purchaseItemDexie(userId, {item_kind: "avatar_frame", item_id: "star", cost: 150});
 */
export async function purchaseItemDexie(
  userId: string,
  input: XpPurchaseInput,
): Promise<XpPurchaseResult> {
  const price = validate(input);
  const id = await purchaseId(userId, input.item_kind, input.item_id);
  const db = getDb();
  let row: XpPurchaseRow | undefined;
  await db.transaction("rw", db.userXp, db.xpPurchases, async () => {
    row = await db.xpPurchases.get(id);
    if (row) return;
    if (!input.already_paid) await deduct(userId, input, price);
    row = {
      id,
      user_id: userId,
      item_kind: input.item_kind,
      item_id: input.item_id,
      cost: price,
      purchased_at: nowIso(),
    };
    await db.xpPurchases.add(row);
  });
  return { xp: await getXPState(userId), purchase: row as XpPurchaseRecord };
}

/** Every recorded purchase of ``userId``, oldest first. */
export async function listPurchasesDexie(userId: string): Promise<XpPurchaseRecord[]> {
  const rows = await getDb().xpPurchases.where({ user_id: userId }).toArray();
  return rows.sort((a, b) => a.purchased_at.localeCompare(b.purchased_at));
}
