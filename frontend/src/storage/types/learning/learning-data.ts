/**
 * Learner-data maintenance namespace — atomic deletion of progress + SRS
 * review cards for removed / orphaned content (#1445 Parts B + C).
 *
 * Distinct from ``lessonProgress`` / ``elementErrors`` because the delete
 * spans BOTH tables in one atomic transaction (no half state). Both storage
 * modes implement this fully: Dexie deletes from IndexedDB, ApiStorage
 * calls ``POST /users/{id}/learning-data/delete`` (#1821).
 */

/** What a deletion removes: specific progress rows + every card of the sets. */
export interface LearningDataDeletion {
  /** ``lessonProgress`` row ids to delete. */
  lessonProgressIds: string[];
  /** Bare set ids whose ``elementErrors`` (review card) rows to delete. */
  setIds: string[];
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
