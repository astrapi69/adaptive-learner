/**
 * AIX-04 (EXP-036) — exercise type distribution + balancing.
 *
 * The model tends to over-produce ``matching`` and under-produce
 * ``cloze`` / ``free_text`` even though the AIX-01 prompt asks for a mix.
 * This step REORDERS the generated cards (never deletes) so:
 *
 *   - no single type is over-represented at the front: the surplus beyond
 *     ``maxPerType`` is pushed to the end,
 *   - the same type never appears three times in a row where another type
 *     is still available (greedy interleave).
 *
 * Pipeline:  AI -> Parser -> Quality Gate -> Distribution (AIX-04) -> Result
 *
 * ``targetDistribution`` + ``minTypes`` describe the *desired* mix; they
 * are advisory (the reorder is driven by ``maxPerType`` + interleaving).
 * {@link distributionGaps} reports types that are absent so AIX-05 can
 * mention them in a regeneration prompt — a hint, not an automatic fix.
 *
 * Library-grade: pure, no app-state / network imports.
 */

import type { ExerciseCard } from "./exercise-quality-gate";

/** The core schema exercise types this generator produces (six since #2353
 *  added ``multiple_choice``). Derived from the parser's card union, so a new
 *  card type surfaces here as a compile error. */
export type ExerciseType = ExerciseCard["type"];

/** Distribution + balancing configuration. */
export interface DistributionConfig {
  /** Desired share per type, in percent (advisory). */
  targetDistribution: Record<ExerciseType, number>;
  /** Desired minimum number of distinct types (advisory). */
  minTypes: number;
  /** Hard cap on how many of one type appear before the surplus is
   *  pushed to the end. */
  maxPerType: number;
}

export const DEFAULT_DISTRIBUTION: DistributionConfig = {
  targetDistribution: {
    matching: 20,
    cloze: 20,
    free_text: 20,
    word_tiles: 15,
    multiple_choice: 15,
    picture_choice: 10,
  },
  minTypes: 3,
  maxPerType: 5,
};

/** Partition cards by type, preserving each type's original order. */
function partitionByType(cards: ExerciseCard[]): Map<ExerciseType, ExerciseCard[]> {
  const byType = new Map<ExerciseType, ExerciseCard[]>();
  for (const card of cards) {
    const bucket = byType.get(card.type);
    if (bucket) bucket.push(card);
    else byType.set(card.type, [card]);
  }
  return byType;
}

/**
 * Greedy interleave: repeatedly take a card from the type with the most
 * remaining, but avoid making three of the same type in a row when
 * another type is still available.
 */
function interleave(byType: Map<ExerciseType, ExerciseCard[]>): ExerciseCard[] {
  const buckets = [...byType.entries()].map(([type, cards]) => ({
    type,
    cards: [...cards],
  }));
  const result: ExerciseCard[] = [];
  while (buckets.some((bucket) => bucket.cards.length > 0)) {
    const available = buckets
      .filter((bucket) => bucket.cards.length > 0)
      .sort((a, b) => b.cards.length - a.cards.length);
    const last = result[result.length - 1]?.type;
    const last2 = result[result.length - 2]?.type;
    const wouldMakeTriple = (type: ExerciseType) =>
      last !== undefined && last2 !== undefined && type === last && type === last2;
    const pick =
      available.find((bucket) => !wouldMakeTriple(bucket.type)) ?? available[0];
    result.push(pick.cards.shift() as ExerciseCard);
  }
  return result;
}

/**
 * Reorder generated cards for a balanced type distribution. Never deletes
 * a card; surplus beyond ``maxPerType`` per type moves to the end.
 *
 * @param cards - Quality-gated cards (AIX-03 output).
 * @param config - Optional distribution overrides.
 * @returns The same cards, reordered.
 */
export function balanceExercises(
  cards: ExerciseCard[],
  config: Partial<DistributionConfig> = {},
): ExerciseCard[] {
  if (cards.length === 0) return [];
  const cfg = { ...DEFAULT_DISTRIBUTION, ...config };
  const maxPerType = Math.max(1, cfg.maxPerType);
  const byType = partitionByType(cards);

  const primary = new Map<ExerciseType, ExerciseCard[]>();
  const overflow: ExerciseCard[] = [];
  for (const [type, bucket] of byType) {
    primary.set(type, bucket.slice(0, maxPerType));
    overflow.push(...bucket.slice(maxPerType));
  }

  const balancedPrimary = interleave(primary);
  const balancedOverflow = interleave(partitionByType(overflow));
  return [...balancedPrimary, ...balancedOverflow];
}

/**
 * Report target types that are absent from the cards when fewer than
 * ``minTypes`` distinct types are present. Advisory — drives the AIX-05
 * "add more variety" regeneration hint, never an automatic fix.
 *
 * @param cards - The generated cards.
 * @param config - Optional distribution overrides.
 * @returns The missing target types (with a positive target share), or
 *          ``[]`` when the variety minimum is already met.
 */
export function distributionGaps(
  cards: ExerciseCard[],
  config: Partial<DistributionConfig> = {},
): ExerciseType[] {
  const cfg = { ...DEFAULT_DISTRIBUTION, ...config };
  const present = new Set(cards.map((card) => card.type));
  if (present.size >= cfg.minTypes) return [];
  return (Object.keys(cfg.targetDistribution) as ExerciseType[]).filter(
    (type) => cfg.targetDistribution[type] > 0 && !present.has(type),
  );
}
