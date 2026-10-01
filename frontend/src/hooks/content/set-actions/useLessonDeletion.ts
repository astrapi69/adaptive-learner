/**
 * Lesson deletion inside a user-generated set, split out of
 * ``useContentSetActions`` (#3271): the single-lesson delete (#2064) and the
 * multi-select bulk lesson delete (#2065), each with its confirm-modal
 * target, in-flight flag and opt-in learner-data plan.
 *
 * @example
 * const lessons = useLessonDeletion({ setSets });
 * lessons.setDeleteLessonTarget({ entry, filename, title });
 * await lessons.handleConfirmDeleteLesson(false);
 */

import { useState } from "react";

import { dismissSet } from "../../../lib/content/browse/lifecycle/dismissed-sets";
import type { DeletionPlan } from "../../../lib/content/browse/lifecycle/orphan-cleanup";
import {
  purgeLessonFromLessonCache,
  purgeSetFromLessonCache,
} from "../../../lib/content/cache/sw-lesson-cache";
import {
  removeLessonFromSet,
  removeLessonsFromSet,
} from "../../../lib/content/lesson/delete/delete-lesson";
import { removeFavorite } from "../../../lib/favorites/favorites";
import { readLearnerState } from "../../../lib/learning/learnerState";
import { getStorage } from "../../../storage";
import type { ContentSetEntry } from "../../../storage/types";
import { notify } from "../../../utils/notify";
import { useI18n } from "../../ui/useI18n";
import {
  computeLessonDeletionPlan,
  computeLessonsDeletionPlan,
  deleteConfirmedLearnerData,
  planAtConfirm,
  planLessonDeletionOrThrow,
  planLessonsDeletionOrThrow,
  reportRemoval,
} from "./deletion-plans";
import { fetchSetLessons } from "./set-entry";
import type { BulkLessonDeleteTarget, LessonDeleteTarget, SetSetsDispatch } from "./types";

interface UseLessonDeletionDeps {
  setSets: SetSetsDispatch;
}

/** Confirm-modal state + handlers for deleting lessons of one set. */
export function useLessonDeletion({ setSets }: UseLessonDeletionDeps) {
  const { t } = useI18n();
  // #2064 — single-lesson delete-confirm modal target (the set + the lesson
  // filename + a display title) + in-flight flag + learner-data plan.
  const [deleteLessonTarget, setDeleteLessonTargetState] =
    useState<LessonDeleteTarget | null>(null);
  const [deletingLesson, setDeletingLesson] = useState(false);
  const [deleteLessonPlan, setDeleteLessonPlan] = useState<DeletionPlan | null>(null);
  // #2065 — bulk multi-select lesson delete-confirm target + in-flight flag +
  // aggregated learner-data plan across the selected lessons.
  const [bulkDeleteLessonsTarget, setBulkDeleteLessonsTargetState] =
    useState<BulkLessonDeleteTarget | null>(null);
  const [bulkDeletingLessons, setBulkDeletingLessons] = useState(false);
  const [bulkDeleteLessonsPlan, setBulkDeleteLessonsPlan] =
    useState<DeletionPlan | null>(null);

  const setDeleteLessonTarget = (target: LessonDeleteTarget | null) => {
    setDeleteLessonTargetState(target);
    setDeleteLessonPlan(null);
    if (target) void computeLessonDeletionPlan(target).then(setDeleteLessonPlan);
  };

  const setBulkDeleteLessonsTarget = (target: BulkLessonDeleteTarget | null) => {
    setBulkDeleteLessonsTargetState(target);
    setBulkDeleteLessonsPlan(null);
    if (target && target.filenames.length > 0) {
      void computeLessonsDeletionPlan(target).then(setBulkDeleteLessonsPlan);
    }
  };

  /** Remove a whole set whose last lesson(s) were deleted: same purge as a
   *  set delete, leaving no empty husk behind. */
  const removeEmptiedSet = async (entry: ContentSetEntry) => {
    await getStorage().contentLoader.deleteSet(entry.source, entry.id);
    await purgeSetFromLessonCache(entry.source, entry.id);
    dismissSet(entry.source, entry.id);
    setSets((prev) =>
      prev.filter((row) => !(row.source === entry.source && row.id === entry.id)),
    );
  };

  /** Mirror a re-saved set's new lesson count into the optimistic list. */
  const updateLessonCount = (entry: ContentSetEntry, remaining: number) => {
    setSets((prev) =>
      prev.map((row) =>
        row.source === entry.source && row.id === entry.id
          ? { ...row, lesson_count: remaining }
          : row,
      ),
    );
  };

  // #2064 — confirm-delete ONE lesson of a user-generated set. The lesson
  // content is always removed (re-save the set without it, or delete the whole
  // set when it was the last lesson); its SW-cache entry + orphaned favorite
  // are purged unconditionally; learning progress + review cards are deleted
  // only via the opt-in checkbox.
  const handleConfirmDeleteLesson = async (deleteProgress = false) => {
    const target = deleteLessonTarget;
    if (!target) return;
    const { entry, filename } = target;
    setDeletingLesson(true);
    try {
      const learnerData = deleteProgress
        ? await planAtConfirm(deleteLessonPlan, () => planLessonDeletionOrThrow(target))
        : null;
      const lessons = await fetchSetLessons(entry);
      const removal = removeLessonFromSet(entry, lessons, filename);
      if (!removal.found) {
        // Already gone (stale UI): treat as success and let the caller refresh.
        notify.success(t("content.lesson_delete.deleted", "Lesson deleted."));
        target.onDeleted?.();
        setDeleteLessonTarget(null);
        return;
      }
      if (removal.input === null) {
        // The last lesson — remove the whole set (same purge as a set delete).
        await removeEmptiedSet(entry);
      } else {
        // Re-save the set without the lesson (saveUserSet purges + rewrites the
        // cache atomically; siblings keep their ids — no renumbering).
        await getStorage().contentLoader.saveUserSet(removal.input);
        await purgeLessonFromLessonCache(entry.source, entry.id, filename);
        updateLessonCount(entry, removal.remaining);
      }
      // A deleted lesson's favorite bookmark is now an orphan — always remove
      // it, regardless of the progress opt-in.
      const userId = readLearnerState().userId;
      if (userId) removeFavorite(userId, entry.id, filename);
      const progressError = learnerData ? await deleteConfirmedLearnerData(learnerData) : null;
      reportRemoval(t, progressError, t("content.lesson_delete.deleted", "Lesson deleted."));
      target.onDeleted?.();
      setDeleteLessonTarget(null);
    } catch (err) {
      notify.error(
        t("content.lesson_delete.delete_failed", "Could not delete the lesson."),
        { error: err },
      );
    } finally {
      setDeletingLesson(false);
    }
  };

  // #2065 — confirm-delete SEVERAL lessons of a user-generated set in one
  // atomic operation. All-or-nothing for the content: a single ``saveUserSet``
  // re-save without the whole selection (or one ``deleteSet`` when the
  // selection empties the set), so a failure leaves the set untouched — never a
  // half-deleted state. Learner data is one aggregated, atomic
  // ``deleteLearningData`` call, opt-in only. Orphaned favorites of every
  // deleted lesson are purged unconditionally.
  const handleConfirmBulkDeleteLessons = async (deleteProgress = false) => {
    const target = bulkDeleteLessonsTarget;
    if (!target || target.filenames.length === 0) return;
    const { entry, filenames } = target;
    setBulkDeletingLessons(true);
    try {
      const learnerData = deleteProgress
        ? await planAtConfirm(bulkDeleteLessonsPlan, () => planLessonsDeletionOrThrow(target))
        : null;
      const lessons = await fetchSetLessons(entry);
      const removal = removeLessonsFromSet(entry, lessons, filenames);
      if (removal.found.length === 0) {
        // Every selected lesson is already gone (stale UI): treat as success
        // and let the caller refresh.
        notify.success(t("content.lesson_delete.deleted", "Lesson deleted."));
        target.onDeleted?.();
        setBulkDeleteLessonsTarget(null);
        return;
      }
      if (removal.emptied) {
        // The selection covered every lesson - remove the whole set.
        await removeEmptiedSet(entry);
      } else {
        // One atomic re-save without the whole selection (saveUserSet purges +
        // rewrites the cache in one write; survivors keep their ids/order).
        await getStorage().contentLoader.saveUserSet(removal.input!);
        for (const filename of removal.found) {
          await purgeLessonFromLessonCache(entry.source, entry.id, filename);
        }
        updateLessonCount(entry, removal.remaining);
      }
      // Every deleted lesson's favorite bookmark is now an orphan — always
      // remove it, regardless of the progress opt-in.
      const userId = readLearnerState().userId;
      if (userId) {
        for (const filename of removal.found) removeFavorite(userId, entry.id, filename);
      }
      const progressError = learnerData ? await deleteConfirmedLearnerData(learnerData) : null;
      reportRemoval(
        t,
        progressError,
        t("content.lesson_delete.bulk_deleted", "{n} lessons deleted.").replace(
          "{n}",
          String(removal.found.length),
        ),
      );
      target.onDeleted?.();
      setBulkDeleteLessonsTarget(null);
    } catch (err) {
      notify.error(
        t("content.lesson_delete.bulk_delete_failed", "Could not delete the lessons."),
        { error: err },
      );
    } finally {
      setBulkDeletingLessons(false);
    }
  };

  return {
    deleteLessonTarget,
    setDeleteLessonTarget,
    deletingLesson,
    deleteLessonPlan,
    handleConfirmDeleteLesson,
    bulkDeleteLessonsTarget,
    setBulkDeleteLessonsTarget,
    bulkDeletingLessons,
    bulkDeleteLessonsPlan,
    handleConfirmBulkDeleteLessons,
  };
}
