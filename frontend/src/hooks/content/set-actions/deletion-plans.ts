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
  planRepoDataDeletion,
  planSetDataDeletion,
  type DeletionPlan,
} from "../../../lib/content/browse/lifecycle/orphan-cleanup";
import { readLearnerState } from "../../../lib/learning/learnerState";
import { getStorage } from "../../../storage";
import { notify } from "../../../utils/notify";
import type { ContentSetEntry } from "../../../storage/types";
import type { BulkLessonDeleteTarget, LessonDeleteTarget } from "./types";

/** Plan the learner-data deletion for one or more sets (#1819); rejects on a
 *  failed read, resolves ``null`` without a learner. */
export const planSetsDeletionOrThrow = async (
  entries: readonly ContentSetEntry[],
): Promise<DeletionPlan | null> => {
  const userId = readLearnerState().userId;
  if (!userId) return null;
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
};

/** Plan the learner-data deletion for a removed content repo (#1445 Part B);
 *  rejects on a failed read. */
export const planRepoDeletionOrThrow = async (
  source: string,
): Promise<DeletionPlan | null> => {
  const userId = readLearnerState().userId;
  if (!userId) return null;
  const storage = getStorage();
  const [progress, cards, setsRes] = await Promise.all([
    storage.lessonProgress.list(userId),
    storage.elementErrors.list(userId, { includeMastered: true }),
    storage.contentLoader.listSets(),
  ]);
  return planRepoDataDeletion(source, progress, cards, setsRes.sets);
};

/** Plan the learner-data deletion for ONE lesson (#2064); rejects on a
 *  failed read. */
export const planLessonDeletionOrThrow = async (
  target: LessonDeleteTarget,
): Promise<DeletionPlan | null> => {
  const userId = readLearnerState().userId;
  if (!userId) return null;
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
};

/** Plan the aggregated learner-data deletion for SEVERAL lessons of one set
 *  (#2065): one live read, one merged plan. */
export const planLessonsDeletionOrThrow = async (
  target: BulkLessonDeleteTarget,
): Promise<DeletionPlan | null> => {
  const userId = readLearnerState().userId;
  if (!userId) return null;
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
};

/** Resolve a planner to ``null`` on failure: the dialog then shows the
 *  checkbox without a number instead of a wrong one. */
const orNull =
  <A>(planner: (arg: A) => Promise<DeletionPlan | null>) =>
  async (arg: A): Promise<DeletionPlan | null> => {
    try {
      return await planner(arg);
    } catch {
      return null;
    }
  };

/** The dialog counts (#1819, #2064, #2065); ``null`` on failure. */
export const computeSetsDeletionPlan = orNull(planSetsDeletionOrThrow);
export const computeLessonDeletionPlan = orNull(planLessonDeletionOrThrow);
export const computeLessonsDeletionPlan = orNull(planLessonsDeletionOrThrow);
export const computeRepoDeletionPlan = orNull(planRepoDeletionOrThrow);

/** The learner-data side of a confirmed deletion (#3382). */
export interface ConfirmedLearnerData {
  plan: DeletionPlan | null;
  /** Why the plan could not be built, or ``null``. */
  planError: string | null;
}

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Settle the plan at confirm time, BEFORE the content is removed (the plan
 * reads the set list): the counted plan when it landed, otherwise a fresh
 * read. A fast confirm while the dialog was still counting used to find
 * ``null`` and skip the deletion the user had asked for (#3382).
 */
export async function planAtConfirm(
  counted: DeletionPlan | null,
  planner: () => Promise<DeletionPlan | null>,
): Promise<ConfirmedLearnerData> {
  if (counted) return { plan: counted, planError: null };
  try {
    return { plan: await planner(), planError: null };
  } catch (err) {
    return { plan: null, planError: messageOf(err) };
  }
}

/**
 * Delete the learner data of a confirmed plan after the content is gone.
 * Resolves to ``null`` when done (or nothing to do), else the reason, so the
 * caller warns instead of claiming success (#3382).
 */
export async function deleteConfirmedLearnerData(
  confirmed: ConfirmedLearnerData,
): Promise<string | null> {
  if (confirmed.planError !== null) return confirmed.planError;
  try {
    await deletePlannedLearnerData(confirmed.plan);
    return null;
  } catch (err) {
    return messageOf(err);
  }
}

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

/**
 * Toast the outcome of a confirmed deletion: ``success`` when the opt-in
 * progress delete went through (or was not asked for), else the #3382
 * warning with the reason, never a success that did not happen.
 */
export function reportRemoval(
  t: (key: string, fallback: string) => string,
  progressError: string | null,
  success: string,
): void {
  if (progressError === null) {
    notify.success(success);
    return;
  }
  notify.warning(
    t(
      "content.set_status.progress_not_deleted",
      "Removed, but your learning progress could not be deleted: {detail}",
    ).replace("{detail}", progressError),
  );
}
