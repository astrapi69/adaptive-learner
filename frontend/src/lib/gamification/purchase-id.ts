/**
 * Deterministic id of one XP purchase (#3445).
 *
 * A purchase is keyed by ``uuid5(PURCHASE_ID_NAMESPACE, "<user>:<kind>:<item>")``
 * in both storage modes; the backend computes the same id in
 * ``adaptive_learner_gamification/purchases.py``. The same purchase is
 * therefore the same row on every device: LAN sync skips a known id instead
 * of hitting the unique key, and the localStorage migration can run again
 * without adding a second row.
 *
 * @example
 * const id = await purchaseId(userId, "avatar_frame", "star");
 */

import type { XpPurchaseKind } from "../../storage/types/learning/gamification";

/** uuid5 namespace shared with the backend. */
export const PURCHASE_ID_NAMESPACE = "6f1c2a52-5d2e-4c1b-9a43-8f0e3b7d9c10";

/** Every kind of item that can be bought with XP. */
export const XP_PURCHASE_KINDS: readonly XpPurchaseKind[] = [
  "avatar_frame",
  "mascot_variant",
  "arcade_game",
];

function uuidBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The RFC 4122 version 5 uuid of one purchase.
 *
 * @param userId - The buyer.
 * @param itemKind - One of {@link XP_PURCHASE_KINDS}.
 * @param itemId - The catalog id within that kind.
 * @returns The same string Python's ``uuid.uuid5`` returns for this input.
 */
export async function purchaseId(
  userId: string,
  itemKind: string,
  itemId: string,
): Promise<string> {
  const name = new TextEncoder().encode(`${userId}:${itemKind}:${itemId}`);
  const input = new Uint8Array(16 + name.length);
  input.set(uuidBytes(PURCHASE_ID_NAMESPACE));
  input.set(name, 16);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", input));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuid(bytes);
}
