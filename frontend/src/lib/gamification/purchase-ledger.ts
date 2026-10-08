/**
 * Reconcile local ownership of XP-bought items with the purchase ledger (#3445).
 *
 * The ledger (``gamification.purchaseItem`` / ``listPurchases``) rides sync
 * and backup in both storage modes; the per-surface selection store
 * (``selection-store.ts``) stays the fast local read. A gallery calls
 * {@link reconcilePurchases} when it loads:
 *
 * - a ledger row this device has not seen (another browser, cleared site
 *   data, a LAN sync) becomes owned locally;
 * - a local purchase from before the ledger existed is recorded once with
 *   ``already_paid`` at its catalog price, without charging again. The
 *   deterministic row id makes a repeat a no-op, so the migration is safe
 *   to run on every load.
 *
 * A failed ledger read keeps local ownership: the decoration must never
 * disappear because the backend is unreachable.
 *
 * @example
 * const owned = await reconcilePurchases(
 *   userId,
 *   AVATAR_FRAME_PURCHASES,
 *   getStorage().gamification,
 * );
 */

import type {
  IGamificationNamespace,
  XpPurchaseKind,
} from "../../storage/types/learning/gamification";
import type { SelectionStore } from "./selection-store";
import type { UnlockCondition } from "./unlockables";

/** One cosmetic surface whose purchases live in the ledger. */
export interface PurchaseSurface {
  kind: XpPurchaseKind;
  store: Pick<SelectionStore, "read" | "addPurchased">;
  /** Catalog price of ``itemId``, or ``undefined`` when it is not for sale. */
  costOf: (itemId: string) => number | undefined;
  /** localStorage override (tests); defaults to the browser's. */
  storage?: Storage;
}

async function migrateLocalOnly(
  userId: string,
  surface: PurchaseSurface,
  ids: readonly string[],
  gamification: IGamificationNamespace,
): Promise<void> {
  for (const itemId of ids) {
    const cost = surface.costOf(itemId);
    if (cost === undefined) continue;
    try {
      await gamification.purchaseItem(userId, {
        item_kind: surface.kind,
        item_id: itemId,
        cost,
        already_paid: true,
      });
    } catch (err) {
      console.warn("purchase ledger migration failed", surface.kind, itemId, err);
    }
  }
}

/**
 * Bring local ownership and the ledger into agreement for one surface.
 *
 * @param userId - The owner.
 * @param surface - Kind, local store and catalog prices of the surface.
 * @param gamification - The active storage's gamification namespace.
 * @returns The owned item ids of this kind after the reconcile, in local
 *   purchase order.
 */
export async function reconcilePurchases(
  userId: string,
  surface: PurchaseSurface,
  gamification: IGamificationNamespace,
): Promise<string[]> {
  const local = surface.store.read(userId, surface.storage).purchased;
  let ledgerIds: string[];
  try {
    const ledger = await gamification.listPurchases(userId);
    ledgerIds = ledger.filter((p) => p.item_kind === surface.kind).map((p) => p.item_id);
  } catch (err) {
    console.warn("purchase ledger read failed", surface.kind, err);
    return local;
  }
  for (const itemId of ledgerIds) {
    if (!local.includes(itemId)) surface.store.addPurchased(userId, itemId, surface.storage);
  }
  const localOnly = local.filter((itemId) => !ledgerIds.includes(itemId));
  await migrateLocalOnly(userId, surface, localOnly, gamification);
  return surface.store.read(userId, surface.storage).purchased;
}

/**
 * Price lookup over a cosmetic catalog: the XP cost of an item sold for XP,
 * ``undefined`` for every other item (free, level or badge unlock, unknown).
 *
 * @param catalog - The surface's item list.
 *
 * @example
 * costOf: xpCostOf(AVATAR_FRAMES)
 */
export function xpCostOf(
  catalog: readonly { id: string; unlock: UnlockCondition }[],
): (itemId: string) => number | undefined {
  return (itemId) => {
    const unlock = catalog.find((item) => item.id === itemId)?.unlock;
    return unlock?.kind === "xp" ? unlock.cost : undefined;
  };
}
