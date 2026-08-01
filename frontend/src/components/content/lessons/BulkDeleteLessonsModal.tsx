/**
 * Confirm modal for deleting SEVERAL lessons of a user-generated set at once
 * (#2065).
 *
 * The bulk counterpart of {@link DeleteLessonFromSetModal}: it names the COUNT
 * of lessons that will go, states honestly that the removal cannot be undone (a
 * backup made earlier still contains them — the time-point recovery), and — as
 * the destructive action is larger here — RECOMMENDS a backup first without
 * forcing it (#2065). When the selection covers every lesson of the set, it
 * says so plainly: the whole set will be deleted. The opt-in learner-data
 * delete carries the aggregated review-card count.
 *
 * Built on {@link ModalShell} (scrollable body + always-visible X + Escape +
 * backdrop close + focus trap, #2266), not the raw ``.modal-overlay`` pattern.
 * Presentational: the page owns the target + the deleting flag + the
 * confirm/cancel handlers.
 */

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import ModalShell from "../../../shared/feedback/ModalShell";
import { useI18n } from "../../../hooks/ui/useI18n";
import DeleteProgressOption from "../browser/delete/DeleteProgressOption";
import type { DeletionPlan } from "../../../lib/content/browse/orphan-cleanup";

export interface BulkDeleteLessonsModalProps {
  /** How many lessons will be deleted, or 0 when the dialog is closed. */
  count: number;
  /** True when the selection covers every lesson of the set — the whole set
   *  will be deleted (no empty husk). */
  emptiesSet: boolean;
  deleting: boolean;
  /** Aggregated opt-in deletion counts across the selected lessons; null while
   *  counting / on failure — the checkbox then shows no numbers. */
  plan?: DeletionPlan | null;
  onCancel: () => void;
  /** Confirm the delete; ``deleteProgress`` carries the opt-in choice. */
  onConfirm: (deleteProgress: boolean) => void;
}

export default function BulkDeleteLessonsModal({
  count,
  emptiesSet,
  deleting,
  plan = null,
  onCancel,
  onConfirm,
}: BulkDeleteLessonsModalProps) {
  const { t } = useI18n();
  const [deleteProgress, setDeleteProgress] = useState(false);

  // Reset the opt-in each time the dialog opens (the component stays mounted
  // across open/close cycles, so useState alone would keep the last choice).
  useEffect(() => {
    if (count > 0) setDeleteProgress(false);
  }, [count]);

  return (
    <ModalShell
      open={count > 0}
      onClose={onCancel}
      testId="bulk-delete-lessons-modal"
      widthClassName="max-w-md"
      closeLabel={t("common.cancel", "Cancel")}
      title={t("content.lesson_delete.bulk_title", "Delete {n} lessons?").replace(
        "{n}",
        String(count),
      )}
    >
      <p>
        {emptiesSet
          ? t(
              "content.lesson_delete.bulk_confirm_empties",
              "These are all the lessons of the set, so the whole set will be deleted. This cannot be undone - a backup you made earlier still contains them.",
            )
          : t(
              "content.lesson_delete.bulk_confirm_body",
              "The selected lessons will be removed from the set. This cannot be undone - a backup you made earlier still contains them.",
            )}
      </p>
      <p
        className="mt-2 text-sm text-fg-secondary"
        data-testid="bulk-delete-lessons-backup-hint"
      >
        {t(
          "content.lesson_delete.bulk_backup_hint",
          "Tip: export a backup first under Settings > Data if you might want these lessons back.",
        )}
      </p>
      <div className="mt-3">
        <DeleteProgressOption
          plan={plan}
          checked={deleteProgress}
          disabled={deleting}
          onChange={setDeleteProgress}
          testId="bulk-delete-lessons-progress-option"
          labelKey="content.lesson_delete.bulk_delete_progress_option"
          labelFallback="Also delete my learning progress for these lessons ({cards} review cards)"
          noCountsKey="content.lesson_delete.bulk_delete_progress_option_nocounts"
          noCountsFallback="Also delete my learning progress for these lessons"
        />
      </div>
      <div className="form-actions mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={deleting}
          data-testid="bulk-delete-lessons-cancel"
        >
          {t("common.cancel", "Cancel")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          data-autofocus
          onClick={() => onConfirm(deleteProgress)}
          disabled={deleting}
          data-testid="bulk-delete-lessons-confirm"
        >
          {deleting
            ? t("common.loading", "Loading…")
            : t("content.lesson_delete.bulk_action_delete", "Delete lessons")}
        </Button>
      </div>
    </ModalShell>
  );
}
