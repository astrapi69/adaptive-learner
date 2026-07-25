/**
 * Learner-data maintenance namespace — atomic deletion of progress + SRS
 * review cards for removed / orphaned content (#1445 Parts B + C).
 *
 * Distinct from ``lessonProgress`` / ``elementErrors`` because the delete
 * spans BOTH tables in one atomic transaction (no half state). Both storage
 * modes implement this fully: Dexie deletes from IndexedDB, ApiStorage
 * calls ``POST /users/{id}/learning-data/delete`` (#1821).
 */

/** One lesson's cards, addressed by set id + lesson id (== filename). */
export interface LessonCardScope {
  set_id: string;
  lesson_id: string;
}

/** What a deletion removes: specific progress rows + review cards, addressed
 *  either by whole set id (``setIds``) or, for a single-lesson delete
 *  (#2064), by the exact ``(set_id, lesson_id)`` pair (``lessonCards``). */
export interface LearningDataDeletion {
  /** ``lessonProgress`` row ids to delete. */
  lessonProgressIds: string[];
  /** Bare set ids whose ``elementErrors`` (review card) rows to delete. */
  setIds: string[];
  /** Lesson-scoped card selectors (#2064). A card is removed when its
   *  ``set_id`` + ``lesson_id`` match one of these — so a sibling lesson of
   *  the same set keeps its cards. Optional; absent = set-granular delete only. */
  lessonCards?: LessonCardScope[];
}

/** The real per-table counts removed. */
export interface LearningDataDeletionResult {
  lessonsDeleted: number;
  cardsDeleted: number;
}

export interface ILearningDataNamespace {
  /**
   * Atomically delete the given progress rows + all review cards for the
   * given set ids, scoped to ``userId``. Works in both storage modes.
   */
  deleteLearningData(
    userId: string,
    deletion: LearningDataDeletion,
  ): Promise<LearningDataDeletionResult>;
}
