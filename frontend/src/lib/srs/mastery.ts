/**
 * Direction-aware mastery helpers (EXP-018 / Phase 62 / v1.46.0).
 *
 * A card is FULLY mastered only when BOTH its receptive
 * (``target_to_source``) and productive (``source_to_target``)
 * ``ElementError`` rows exist AND are mastered. A card drilled only
 * receptively is NOT fully mastered — production was never shown.
 * This is why the dashboard reports the receptive and productive
 * mastery counts separately.
 *
 * Mirror of ``app.services.element_errors.is_fully_mastered``.
 */

import type {ElementError} from "../../storage/types";

export const RECEPTIVE = "target_to_source";
export const PRODUCTIVE = "source_to_target";

/** Identity of one learnable element, ignoring direction. */
function elementIdentity(error: ElementError): string {
  return [
    error.set_id,
    error.lesson_id,
    error.exercise_id,
    error.element_key,
  ].join("#");
}

/**
 * True when BOTH directions of an element are mastered. ``rows`` are
 * the per-direction rows for a single element (extra unrelated rows
 * are harmless — only a mastered receptive AND a mastered productive
 * row flip the result true).
 */
export function isFullyMastered(rows: readonly ElementError[]): boolean {
  let receptive = false;
  let productive = false;
  for (const row of rows) {
    if (!row.mastered) continue;
    if (row.direction === PRODUCTIVE) productive = true;
    else if (row.direction === RECEPTIVE) receptive = true;
  }
  return receptive && productive;
}

export interface MasteryCounts {
  /** Mastered rows in the receptive direction. */
  receptive: number;
  /** Mastered rows in the productive direction. */
  productive: number;
  /** Elements whose BOTH directions are mastered. */
  fully: number;
}

/**
 * Count mastered elements split by direction across ALL rows.
 * ``receptive`` / ``productive`` count mastered rows per direction;
 * ``fully`` counts distinct elements mastered in both directions.
 */
export function masteryCounts(rows: readonly ElementError[]): MasteryCounts {
  let receptive = 0;
  let productive = 0;
  const byElement = new Map<string, ElementError[]>();
  for (const row of rows) {
    if (row.mastered) {
      if (row.direction === PRODUCTIVE) productive += 1;
      else if (row.direction === RECEPTIVE) receptive += 1;
    }
    const key = elementIdentity(row);
    const list = byElement.get(key);
    if (list) list.push(row);
    else byElement.set(key, [row]);
  }
  let fully = 0;
  for (const list of byElement.values()) {
    if (isFullyMastered(list)) fully += 1;
  }
  return {receptive, productive, fully};
}
