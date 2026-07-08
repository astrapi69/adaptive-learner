/**
 * Learner-data maintenance namespace — atomic deletion of progress + SRS
 * review cards for removed / orphaned content (#1445 Parts B + C).
 *
 * Distinct from ``lessonProgress`` / ``elementErrors`` because the delete
 * spans BOTH tables in one atomic transaction (no half state). Dexie mode
 * owns the local IndexedDB store and implements this fully; ApiStorage's
 * server-side data is managed via backup/reset, so it throws — the UI gates
 * the delete affordance on the storage mode.
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
   * given set ids, scoped to ``userId``. Dexie mode only — ApiStorage throws.
   */
  deleteLearningData(
    userId: string,
    deletion: LearningDataDeletion,
  ): Promise<LearningDataDeletionResult>;
}
