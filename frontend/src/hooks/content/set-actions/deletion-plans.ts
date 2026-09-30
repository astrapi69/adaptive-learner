/**
 * Learner-data deletion plans for the set and lesson delete dialogs (#1819,
 * #2064, #2065), split out of ``useContentSetActions`` (#3271).
 *
 * Counts come from live storage reads, never estimates. Every planner
 * resolves to ``null`` on failure (or without a learner), so the dialog shows
 * the opt-in checkbox without a number instead of a wrong one.
 *
 * @example
 * const plan = await computeSetsDeletionPlan([entry]);
 * if (deleteProgress) await deletePlannedLearnerData(plan);
 */

import {
  isEmptyPlan,
  planLessonDataDeletion,
  planLessonsDataDeletion,
  planSetDataDeletion,
  type DeletionPlan,
} from "../../../lib/content/browse/lifecycle/orphan-cleanup";
import { readLearnerState } from "../../../lib/learning/learnerState";
import { getStorage } from "../../../storage";
import type { ContentSetEntry } from "../../../storage/types";
import type { BulkLessonDeleteTarget, LessonDeleteTarget } from "./types";

/** Plan the learner-data deletion for one or more sets (#1819). */
export const computeSetsDeletionPlan = async (
  entries: readonly ContentSetEntry[],
): Promise<DeletionPlan | null> => {
  const userId = readLearnerState().userId;
  if (!userId) return null;
  try {
    const storage = getStorage();
    const [progress, cards, setsRes] = await Promise.all([
      storage.lessonProgress.list(userId),
      storage.elementErrors.list(userId, { includeMastered: true }),
      storage.contentLoader.listSets(),
    ]);
    const merged: DeletionPlan = {
      lessonProgressIds: [],
      orphanedSetIds: [],
      lessonCount: 0,
      cardCount: 0,
    };
    for (const entry of entries) {
      const plan = planSetDataDeletion(
        entry.source,
        entry.id,
        progress,
        cards,
        setsRes.sets,
      );
      merged.lessonProgressIds.push(...plan.lessonProgressIds);
      merged.orphanedSetIds.push(...plan.orphanedSetIds);
      merged.lessonCount += plan.lessonCount;
      merged.cardCount += plan.cardCount;
    }
    return merged;
  } catch {
    return null;
  }
};

/** Plan the learner-data deletion for ONE lesson (#2064). */
export const computeLessonDeletionPlan = async (
  target: LessonDeleteTarget,
): Promise<DeletionPlan | null> => {
  const userId = readLearnerState().userId;
  if (!userId) return null;
  try {
    const storage = getStorage();
    const [progress, cards] = await Promise.all([
      storage.lessonProgress.list(userId),
      storage.elementErrors.list(userId, { includeMastered: true }),
    ]);
    return planLessonDataDeletion(
      target.entry.source,
      target.entry.id,
      target.filename,
      progress,
      cards,
    );
  } catch {
    return null;
  }
};

/** Plan the aggregated learner-data deletion for SEVERAL lessons of one set
 *  (#2065): one live read, one merged plan. */
export const computeLessonsDeletionPlan = async (
  target: BulkLessonDeleteTarget,
): Promise<DeletionPlan | null> => {
  const userId = readLearnerState().userId;
  if (!userId) return null;
  try {
    const storage = getStorage();
    const [progress, cards] = await Promise.all([
      storage.lessonProgress.list(userId),
      storage.elementErrors.list(userId, { includeMastered: true }),
    ]);
    return planLessonsDataDeletion(
      target.entry.source,
      target.entry.id,
      target.filenames,
      progress,
      cards,
    );
  } catch {
    return null;
  }
};

/** Delete the planned learner data after the cache delete (#1819).
 *  Opt-in only; an empty/unknown plan is a no-op. */
export const deletePlannedLearnerData = async (plan: DeletionPlan | null) => {
  const userId = readLearnerState().userId;
  if (!userId || !plan || isEmptyPlan(plan)) return;
  await getStorage().learningData.deleteLearningData(userId, {
    lessonProgressIds: plan.lessonProgressIds,
    setIds: plan.orphanedSetIds,
    lessonCards: plan.lessonCards,
  });
};
