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
 * delete carries the aggregated review-card count. Presentational: the page
 * owns the target + the deleting flag + the confirm/cancel handlers.
 */

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

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
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [deleteProgress, setDeleteProgress] = useState(false);

  useEffect(() => {
    if (count === 0) return;
    setDeleteProgress(false);
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count, onCancel]);

  if (count === 0) return null;
  return (
    <div className="modal-overlay" data-testid="bulk-delete-lessons-modal">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-lessons-title"
      >
        <h2 id="bulk-delete-lessons-title" className="modal-title">
          {t("content.lesson_delete.bulk_title", "Delete {n} lessons?").replace(
            "{n}",
            String(count),
          )}
        </h2>
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
        <p className="text-sm text-fg-secondary" data-testid="bulk-delete-lessons-backup-hint">
          {t(
            "content.lesson_delete.bulk_backup_hint",
            "Tip: export a backup first under Settings > Data if you might want these lessons back.",
          )}
        </p>
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
        <div className="form-actions">
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
            ref={confirmRef}
            type="button"
            variant="destructive"
            onClick={() => onConfirm(deleteProgress)}
            disabled={deleting}
            data-testid="bulk-delete-lessons-confirm"
          >
            {deleting
              ? t("common.loading", "Loading…")
              : t("content.lesson_delete.bulk_action_delete", "Delete lessons")}
          </Button>
        </div>
      </div>
    </div>
  );
}
