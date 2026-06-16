/**
 * gamification/xp-spent-event — a lightweight window event announcing that
 * XP was just deducted (#594 Hint Economy).
 *
 * The XP award path already refreshes the header badge through the
 * celebration bus, but a *spend* (a revealed hint) is not a celebration —
 * it should briefly flash the badge red, not fire a praise sound. This
 * decoupled DOM event lets any spend site notify the badge without a
 * shared store. The badge listens, re-reads its total, and flashes.
 */

/** Dispatched on ``window`` after XP is deducted. ``detail.amount`` is the
 *  positive number of points spent. */
export const XP_SPENT_EVENT = "adaptive-learner:xp-spent";

export interface XpSpentDetail {
  amount: number;
  reason: string;
}

/** Fire the XP-spent event (no-op outside the browser). */
export function emitXpSpent(amount: number, reason: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<XpSpentDetail>(XP_SPENT_EVENT, {
      detail: { amount, reason },
    }),
  );
}
