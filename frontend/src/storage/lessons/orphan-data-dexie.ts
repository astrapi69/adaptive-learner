/**
 * Atomic deletion of learner data for removed / orphaned content (#1445
 * Parts B + C).
 *
 * ``lessonProgress`` and ``elementErrors`` are deleted together inside ONE
 * ``rw`` transaction so a "delete my progress" action can never leave a half
 * state (lessons gone, review cards left, or vice versa). Both deletes are
 * user-scoped (``user_id``) so a shared-device profile only ever removes its
 * own rows. Returns the real counts removed.
 */

import { getDb } from "../dexie/db";

/** What to delete: specific progress rows + every card of the given sets. */
export interface LearningDataDeletion {
  /** ``lessonProgress`` row ids to delete. */
  lessonProgressIds: readonly string[];
  /** Bare set ids whose ``elementErrors`` rows to delete. */
  setIds: readonly string[];
}

/** Counts actually removed, per table. */
export interface LearningDataDeletionResult {
  lessonsDeleted: number;
  cardsDeleted: number;
}

/**
 * Delete the given progress rows + all element-error rows for the given set
 * ids, for ``userId``, in a single atomic transaction.
 */
export async function deleteLearningDataDexie(
  userId: string,
  deletion: LearningDataDeletion,
): Promise<LearningDataDeletionResult> {
  const db = getDb();
  const progressIds = [...deletion.lessonProgressIds];
  const setIds = [...deletion.setIds];
  if (progressIds.length === 0 && setIds.length === 0) {
    return { lessonsDeleted: 0, cardsDeleted: 0 };
  }
  let lessonsDeleted = 0;
  let cardsDeleted = 0;
  await db.transaction("rw", db.lessonProgress, db.elementErrors, async () => {
    if (progressIds.length > 0) {
      lessonsDeleted = await db.lessonProgress
        .where("id")
        .anyOf(progressIds)
        .and((row) => row.user_id === userId)
        .delete();
    }
    if (setIds.length > 0) {
      cardsDeleted = await db.elementErrors
        .where("[user_id+set_id]")
        .anyOf(setIds.map((setId) => [userId, setId]))
        .delete();
    }
  });
  return { lessonsDeleted, cardsDeleted };
}
