/**
 * Confirm modal for deleting ONE lesson of a user-generated set (#2064).
 *
 * Mirrors the ``.modal-overlay`` / ``.modal-card`` pattern of DeleteSetModal:
 * focus-trappable role="dialog", aria-modal, Escape + Cancel dismiss. Names the
 * lesson, states honestly that the removal cannot be undone (a backup made
 * earlier still contains it — the time-point recovery, #2064 decision #2), and
 * offers the opt-in learner-data delete with the real review-card count
 * (decision #1). Presentational: the page owns the target + the deleting flag
 * + the confirm/cancel handlers.
 */

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { useI18n } from "../../../hooks/ui/useI18n";
import DeleteProgressOption from "../browser/delete/DeleteProgressOption";
import type { LessonDeleteTarget } from "../../../hooks/content/useContentSetActions";
import type { DeletionPlan } from "../../../lib/content/browse/orphan-cleanup";

export interface DeleteLessonFromSetModalProps {
  /** The lesson to delete, or null when the dialog is closed. */
  target: LessonDeleteTarget | null;
  deleting: boolean;
  /** What the opt-in progress delete would remove; null while counting / on
   *  failure - the checkbox then shows no numbers. */
  plan?: DeletionPlan | null;
  onCancel: () => void;
  /** Confirm the delete; ``deleteProgress`` carries the opt-in choice. */
  onConfirm: (deleteProgress: boolean) => void;
}

export default function DeleteLessonFromSetModal({
  target,
  deleting,
  plan = null,
  onCancel,
  onConfirm,
}: DeleteLessonFromSetModalProps) {
  const { t } = useI18n();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [deleteProgress, setDeleteProgress] = useState(false);

  useEffect(() => {
    if (!target) return;
    setDeleteProgress(false);
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [target, onCancel]);

  if (!target) return null;
  return (
    <div className="modal-overlay" data-testid="delete-lesson-from-set-modal">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-lesson-from-set-title"
      >
        <h2 id="delete-lesson-from-set-title" className="modal-title">
          {target.title}
        </h2>
        <p>
          {t(
            "content.lesson_delete.confirm_body",
            "This lesson will be removed from the set. This cannot be undone - a backup you made earlier still contains it.",
          )}
        </p>
        <DeleteProgressOption
          plan={plan}
          checked={deleteProgress}
          disabled={deleting}
          onChange={setDeleteProgress}
          testId="delete-lesson-progress-option"
          labelKey="content.lesson_delete.delete_progress_option"
          labelFallback="Also delete my learning progress for this lesson ({cards} review cards)"
          noCountsKey="content.lesson_delete.delete_progress_option_nocounts"
          noCountsFallback="Also delete my learning progress for this lesson"
        />
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={deleting}
            data-testid="delete-lesson-from-set-cancel"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant="destructive"
            onClick={() => onConfirm(deleteProgress)}
            disabled={deleting}
            data-testid="delete-lesson-from-set-confirm"
          >
            {deleting
              ? t("common.loading", "Loading…")
              : t("content.lesson_delete.action_delete", "Delete lesson")}
          </Button>
        </div>
      </div>
    </div>
  );
}
