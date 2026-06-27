/**
 * EXP-033 / AIV-08 — deterministic content hash of a set's cards.
 *
 * The hash anchors the AI-validation signature (AIV-09): if any card
 * changes, the hash changes and the signature no longer matches the
 * content. The algorithm is fixed so a client and a CI checker produce
 * the SAME hash for the same cards (cross-language parity, EXP-033 §5.3):
 *
 *   1. Take ``{id, front, back, notes}`` from each card (notes "" when
 *      null/absent — a fixed, explicit field order).
 *   2. Sort by ``id``.
 *   3. ``JSON.stringify`` with no whitespace.
 *   4. SHA-256, lower-case hex, prefixed ``sha256:``.
 *
 * Pure aside from WebCrypto (``crypto.subtle.digest``), available in
 * browsers + the test runtime.
 */

export interface HashableCard {
  id: string;
  front: string;
  back: string;
  notes?: string | null;
}

/** Canonical, whitespace-free serialisation of the cards (exported so a
 *  CI/Python parity test can compare the intermediate string). */
export function canonicalCardString(cards: readonly HashableCard[]): string {
  const normalised = cards
    .map((c) => ({
      id: c.id,
      front: c.front,
      back: c.back,
      notes: c.notes ?? "",
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    // Fixed key order via an array of [k, v] → object rebuild keeps the
    // serialisation stable regardless of input key order.
    .map((c) => ({ id: c.id, front: c.front, back: c.back, notes: c.notes }));
  return JSON.stringify(normalised);
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Compute the ``sha256:`` content hash of the cards. */
export async function computeContentHash(
  cards: readonly HashableCard[],
): Promise<string> {
  const data = new TextEncoder().encode(canonicalCardString(cards));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return `sha256:${toHex(digest)}`;
}
