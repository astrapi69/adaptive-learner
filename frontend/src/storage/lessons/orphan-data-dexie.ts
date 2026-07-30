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

/** One lesson's cards, addressed by set id + lesson id (== filename). */
export interface LessonCardScope {
  set_id: string;
  lesson_id: string;
}

/** What to delete: specific progress rows + review cards (by whole set id, or
 *  by the exact lesson for a single-lesson delete, #2064). */
export interface LearningDataDeletion {
  /** ``lessonProgress`` row ids to delete. */
  lessonProgressIds: readonly string[];
  /** Bare set ids whose ``elementErrors`` rows to delete. */
  setIds: readonly string[];
  /** Lesson-scoped card selectors (#2064): a card is deleted when its
   *  ``set_id`` + ``lesson_id`` match one of these, so a sibling lesson of the
   *  same set keeps its cards. */
  lessonCards?: readonly LessonCardScope[];
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
  const lessonCards = [...(deletion.lessonCards ?? [])];
  if (progressIds.length === 0 && setIds.length === 0 && lessonCards.length === 0) {
    return { lessonsDeleted: 0, cardsDeleted: 0 };
  }
  const lessonKeys = new Set(
    lessonCards.map((card) => `${card.set_id}#${card.lesson_id}`),
  );
  const lessonSetIds = [...new Set(lessonCards.map((card) => card.set_id))];
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
    if (lessonKeys.size > 0) {
      // Lesson-scoped card delete (#2064): scan the affected sets via the
      // ``[user_id+set_id]`` index, keep only rows whose lesson matches.
      cardsDeleted += await db.elementErrors
        .where("[user_id+set_id]")
        .anyOf(lessonSetIds.map((setId) => [userId, setId]))
        .and((row) => lessonKeys.has(`${row.set_id}#${row.lesson_id}`))
        .delete();
    }
  });
  return { lessonsDeleted, cardsDeleted };
}
