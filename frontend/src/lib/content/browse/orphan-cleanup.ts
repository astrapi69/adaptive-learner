/**
 * orphan-cleanup — pure planners for deleting learner progress tied to a
 * removed / no-longer-connected content repository (#1445 Parts B + C).
 *
 * Learner progress lives in two Dexie tables:
 *   - ``lessonProgress`` — carries ``source`` (the repo) + ``set_id`` →
 *     exact per-repo attribution.
 *   - ``elementErrors`` (SRS review cards) — carries only a bare ``set_id``
 *     (no source). A card is attributed to a repo by set availability: it is
 *     orphaned when NO loadable set carries its ``set_id``. This is deliberately
 *     safe — a card whose content is still loadable from another connected repo
 *     is never deleted, at the cost of keeping a card when two repos happen to
 *     share a set id.
 *
 * These functions decide WHAT to delete (ids / set-ids + honest counts); the
 * storage layer performs the delete atomically. Everything here is pure so the
 * numbers shown to the user before an irreversible delete come from real data,
 * not estimates.
 */

import {
  buildContentAvailability,
  partitionProgress,
  type SetKey,
  type SetIdRow,
  type SourcedSetRow,
} from "./content-availability";

/** A progress row shaped for planning (id + repo attribution). */
export interface PlannableProgress extends SourcedSetRow {
  id: string;
}

/** An SRS row shaped for planning + honest card counting. */
export interface PlannableCard extends SetIdRow {
  lesson_id?: string;
  exercise_id?: string;
  element_key?: string;
}

/** What a deletion will remove, with user-facing counts. */
export interface DeletionPlan {
  /** ``lessonProgress`` row ids to delete. */
  lessonProgressIds: string[];
  /** Bare set ids whose ``elementErrors`` rows to delete. */
  orphanedSetIds: string[];
  /** Number of lessons (progress rows) removed. */
  lessonCount: number;
  /** Number of distinct review cards removed (deduped across SRS directions,
   *  so a receptive + productive pair of one element counts once). */
  cardCount: number;
}

/**
 * Count distinct review cards among ``cards`` restricted to ``setIds``.
 * ``elementErrors`` stores one row per drill DIRECTION, so the raw row count
 * roughly doubles the number of cards a learner recognises. Dedup by element
 * identity for an honest "Y cards" figure.
 */
export function distinctCardCount(
  cards: readonly PlannableCard[],
  setIds: ReadonlySet<string>,
): number {
  const seen = new Set<string>();
  for (const card of cards) {
    if (!setIds.has(card.set_id)) continue;
    seen.add(
      `${card.set_id}#${card.lesson_id ?? ""}#${card.exercise_id ?? ""}#${
        card.element_key ?? ""
      }`,
    );
  }
  return seen.size;
}

/**
 * Plan the deletion of ONE repo's learner data on removal (#1445 Part B).
 *
 * Lessons are attributed by ``source`` (exact). Cards are attributed to the
 * repo's sets that become unavailable once it is gone — a set id the removed
 * repo provided AND that no OTHER still-listed source provides — so a set id
 * shared with another connected repo keeps its cards.
 *
 * @param sourceToRemove The repo ``owner/repo`` being removed.
 * @param progress All of the user's ``lessonProgress`` rows.
 * @param cards All of the user's ``elementErrors`` rows.
 * @param currentSets The loadable-set list BEFORE removal (``listSets().sets``,
 *   still including the repo being removed) — used to find set ids the repo
 *   uniquely provides.
 */
export function planRepoDataDeletion(
  sourceToRemove: string,
  progress: readonly PlannableProgress[],
  cards: readonly PlannableCard[],
  currentSets: readonly SetKey[],
): DeletionPlan {
  const repoProgress = progress.filter((p) => p.source === sourceToRemove);
  const repoSetIds = new Set(repoProgress.map((p) => p.set_id));
  const providedByOtherSources = new Set(
    currentSets.filter((s) => s.source !== sourceToRemove).map((s) => s.id),
  );
  const orphanedSetIds = [...repoSetIds].filter(
    (id) => !providedByOtherSources.has(id),
  );
  const orphanedSetIdSet = new Set(orphanedSetIds);
  return {
    lessonProgressIds: repoProgress.map((p) => p.id),
    orphanedSetIds,
    lessonCount: repoProgress.length,
    cardCount: distinctCardCount(cards, orphanedSetIdSet),
  };
}

/**
 * Plan the cleanup of ALL orphaned learner data — progress + cards whose
 * source is no longer connected (#1445 Part C).
 *
 * @param progress All of the user's ``lessonProgress`` rows.
 * @param cards All of the user's ``elementErrors`` rows.
 * @param currentSets The loadable-set list (``listSets().sets``).
 */
export function planOrphanCleanup(
  progress: readonly PlannableProgress[],
  cards: readonly PlannableCard[],
  currentSets: readonly SetKey[],
): DeletionPlan {
  const availability = buildContentAvailability(currentSets);
  const { orphaned } = partitionProgress(progress, availability);
  const orphanedSetIds = [
    ...new Set(
      cards.filter((c) => !availability.hasSetId(c.set_id)).map((c) => c.set_id),
    ),
  ];
  return {
    lessonProgressIds: orphaned.map((p) => p.id),
    orphanedSetIds,
    lessonCount: orphaned.length,
    cardCount: distinctCardCount(cards, new Set(orphanedSetIds)),
  };
}

/** True when a plan would delete nothing (used to hide an empty cleanup UI). */
export function isEmptyPlan(plan: DeletionPlan): boolean {
  return plan.lessonCount === 0 && plan.cardCount === 0;
}
