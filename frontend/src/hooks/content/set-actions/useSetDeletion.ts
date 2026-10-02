/**
 * Whole-set deletion for the /content page, split out of
 * ``useContentSetActions`` (#3271): the "My Lessons" delete (Phase 59C), the
 * downloaded-set delete (#1300) and the multi-select bulk delete (#1351),
 * each with its confirm-modal target, in-flight flag and, for downloaded
 * sets, the opt-in learner-data plan (#1819).
 *
 * @example
 * const deletion = useSetDeletion({ setSets });
 * deletion.setDeleteSetTarget(entry); // opens the dialog, starts the count
 * await deletion.handleConfirmDeleteSet(true);
 */

import { useState } from "react";

import { dismissSet, dismissSets } from "../../../lib/content/browse/lifecycle/dismissed-sets";
import type { DeletionPlan } from "../../../lib/content/browse/lifecycle/orphan-cleanup";
import { purgeSetFromLessonCache } from "../../../lib/content/cache/sw-lesson-cache";
import { getStorage } from "../../../storage";
import type { ContentSetEntry } from "../../../storage/types";
import { notify } from "../../../utils/notify";
import { useI18n } from "../../ui/useI18n";
import {
  computeSetsDeletionPlan,
  deleteConfirmedLearnerData,
  planAtConfirm,
  planSetsDeletionOrThrow,
  reportRemoval,
  type ConfirmedLearnerData,
} from "./deletion-plans";
import { setKey } from "./set-entry";
import type { SetSetsDispatch } from "./types";

interface UseSetDeletionDeps {
  setSets: SetSetsDispatch;
}

/** Confirm-modal state + handlers for deleting whole sets. */
export function useSetDeletion({ setSets }: UseSetDeletionDeps) {
  const { t } = useI18n();
  // Phase 59C — My Lessons delete-confirm modal target.
  const [deleteTarget, setDeleteTarget] = useState<ContentSetEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  // #1300 — downloaded-set delete-confirm modal target + status flow.
  const [deleteSetTarget, setDeleteSetTargetState] = useState<ContentSetEntry | null>(null);
  const [deletingSet, setDeletingSet] = useState(false);
  // #1819 — the "what gets deleted" plan for the opt-in progress delete
  // (null while counting / when no target; mirrors the repo-removal dialog).
  const [deleteSetPlan, setDeleteSetPlan] = useState<DeletionPlan | null>(null);
  // #1351 — multi-select bulk delete-confirm targets + in-flight flag.
  const [bulkDeleteTargets, setBulkDeleteTargetsState] = useState<ContentSetEntry[] | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeletePlan, setBulkDeletePlan] = useState<DeletionPlan | null>(null);

  const setDeleteSetTarget = (entry: ContentSetEntry | null) => {
    setDeleteSetTargetState(entry);
    setDeleteSetPlan(null);
    if (entry) void computeSetsDeletionPlan([entry]).then(setDeleteSetPlan);
  };

  const setBulkDeleteTargets = (entries: ContentSetEntry[] | null) => {
    setBulkDeleteTargetsState(entries);
    setBulkDeletePlan(null);
    if (entries && entries.length > 0) {
      void computeSetsDeletionPlan(entries).then(setBulkDeletePlan);
    }
  };

  // #1300 — confirm-delete a downloaded set (purges the cached set + its
  // lessons from the local cache AND the SW lesson cache; learning progress
  // is deleted only via the opt-in checkbox, #1819).
  const handleConfirmDeleteSet = async (deleteProgress = false) => {
    if (!deleteSetTarget) return;
    setDeletingSet(true);
    try {
      const target = deleteSetTarget;
      const learnerData = deleteProgress
        ? await planAtConfirm(deleteSetPlan, () => planSetsDeletionOrThrow([target]))
        : null;
      await getStorage().contentLoader.deleteSet(deleteSetTarget.source, deleteSetTarget.id);
      await purgeSetFromLessonCache(deleteSetTarget.source, deleteSetTarget.id);
      const progressError = learnerData ? await deleteConfirmedLearnerData(learnerData) : null;
      // #1709 — remember the explicit deletion so a Refresh (which re-reads
      // the source catalogue) does not restore the set into "Meine Inhalte".
      dismissSet(deleteSetTarget.source, deleteSetTarget.id);
      setSets((prev) =>
        prev.filter(
          (row) => !(row.source === deleteSetTarget.source && row.id === deleteSetTarget.id),
        ),
      );
      reportRemoval(t, progressError, t("content.set_status.deleted", "Set removed."));
      setDeleteSetTarget(null);
    } catch (err) {
      notify.error(
        t("content.set_status.delete_failed", "Could not remove the set."),
        { error: err },
      );
    } finally {
      setDeletingSet(false);
    }
  };

  // #1351 — confirm-delete the selected sets. One batched Dexie transaction
  // (set rows + lessons) + SW-cache purge; learning progress is deleted only
  // via the opt-in checkbox (#1819).
  const handleConfirmBulkDelete = async (deleteProgress = false) => {
    const targets = bulkDeleteTargets;
    if (!targets || targets.length === 0) return;
    setBulkDeleting(true);
    const keys = new Set(targets.map(setKey));
    try {
      const learnerData: ConfirmedLearnerData | null = deleteProgress
        ? await planAtConfirm(bulkDeletePlan, () => planSetsDeletionOrThrow(targets))
        : null;
      await getStorage().contentLoader.deleteSets(
        targets.map((e) => ({ source: e.source, setId: e.id })),
      );
      for (const entry of targets) {
        await purgeSetFromLessonCache(entry.source, entry.id);
      }
      const progressError = learnerData ? await deleteConfirmedLearnerData(learnerData) : null;
      // #1709 — remember the explicit deletions so a Refresh (which re-reads
      // the source catalogue) does not restore the sets into "Meine Inhalte".
      dismissSets(targets.map((e) => ({ source: e.source, setId: e.id })));
      setSets((prev) => prev.filter((row) => !keys.has(setKey(row))));
      reportRemoval(
        t,
        progressError,
        t("content.set_status.bulk_deleted", "{n} sets removed.").replace(
          "{n}",
          String(targets.length),
        ),
      );
      setBulkDeleteTargets(null);
    } catch (err) {
      notify.error(
        t("content.set_status.delete_failed", "Could not remove the set."),
        { error: err },
      );
    } finally {
      setBulkDeleting(false);
    }
  };

  // Phase 59C - confirm-delete a "My Lessons" set.
  const handleDeleteUserSet = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await getStorage().contentLoader.deleteSet(deleteTarget.source, deleteTarget.id);
      await purgeSetFromLessonCache(deleteTarget.source, deleteTarget.id);
      setSets((prev) =>
        prev.filter((row) => !(row.source === deleteTarget.source && row.id === deleteTarget.id)),
      );
      notify.success(t("content.my_lessons.deleted", "Lesson deleted."));
      setDeleteTarget(null);
    } catch (err) {
      notify.error(
        t("content.my_lessons.delete_failed", "Could not delete the lesson."),
        { error: err },
      );
    } finally {
      setDeleting(false);
    }
  };

  return {
    deleteTarget,
    setDeleteTarget,
    deleting,
    handleDeleteUserSet,
    deleteSetTarget,
    setDeleteSetTarget,
    deletingSet,
    deleteSetPlan,
    handleConfirmDeleteSet,
    bulkDeleteTargets,
    setBulkDeleteTargets,
    bulkDeleting,
    bulkDeletePlan,
    handleConfirmBulkDelete,
  };
}
