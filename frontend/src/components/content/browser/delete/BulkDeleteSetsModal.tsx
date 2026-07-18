/**
 * BulkDeleteSetsModal (#1351) — destructive confirmation for removing
 * SEVERAL downloaded sets at once from "Meine Inhalte".
 *
 * Mirrors {@link DeleteSetModal} (the ``.modal-overlay`` / ``.modal-card``
 * pattern) but states the COUNT honestly: N sets and their cached lessons
 * are removed, learning progress is kept, and the sets can be downloaded
 * again anytime.
 */

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { useI18n } from "../../../../hooks/ui/useI18n";
import DeleteProgressOption from "./DeleteProgressOption";
import type { DeletionPlan } from "../../../../lib/content/browse/orphan-cleanup";

export interface BulkDeleteSetsModalProps {
  /** How many sets will be deleted, or 0/null when the dialog is closed. */
  count: number;
  deleting: boolean;
  /** Aggregated opt-in deletion counts across the selected sets (#1819). */
  plan?: DeletionPlan | null;
  onCancel: () => void;
  /** Confirm the delete; ``deleteProgress`` carries the opt-in choice. */
  onConfirm: (deleteProgress: boolean) => void;
}

export default function BulkDeleteSetsModal({
  count,
  deleting,
  plan = null,
  onCancel,
  onConfirm,
}: BulkDeleteSetsModalProps) {
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
    <div className="modal-overlay" data-testid="bulk-delete-sets-modal">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-sets-title"
      >
        <h2 id="bulk-delete-sets-title" className="modal-title">
          {t("content.set_status.bulk_delete_title", "Delete {n} sets?").replace(
            "{n}",
            String(count),
          )}
        </h2>
        <p>
          {t(
            "content.set_status.bulk_delete_confirm",
            "The selected sets and their lessons will be removed from My Content. Your learning progress is kept, and you can download the sets again anytime.",
          )}
        </p>
        <DeleteProgressOption
          plan={plan}
          checked={deleteProgress}
          disabled={deleting}
          onChange={setDeleteProgress}
          testId="bulk-delete-sets-progress-option"
        />
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={deleting}
            data-testid="bulk-delete-sets-cancel"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant="destructive"
            onClick={() => onConfirm(deleteProgress)}
            disabled={deleting}
            data-testid="bulk-delete-sets-confirm"
          >
            {deleting
              ? t("common.loading", "Loading…")
              : t("content.set_status.action.delete", "Delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
