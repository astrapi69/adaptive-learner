/**
 * DeleteSetModal — the destructive confirmation before removing a
 * downloaded set from "Meine Inhalte" (#1300).
 *
 * Mirrors the established ``.modal-overlay`` / ``.modal-card`` pattern
 * (see DeleteLessonModal): focus-trappable role="dialog", aria-modal,
 * Escape + Cancel dismiss. The body states honestly what the delete
 * removes — the downloaded set + its cached lessons — and that the set
 * can be downloaded again at any time (the delete purges the
 * ``contentSets`` + ``contentSetFiles`` cache rows only; learning
 * progress is not deleted).
 */

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

import { useI18n } from "../../../hooks/ui/useI18n";
import type { ContentSetEntry } from "../../../storage/types";

export interface DeleteSetModalProps {
  /** The set to delete, or null when the dialog is closed. */
  target: ContentSetEntry | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteSetModal({
  target,
  deleting,
  onCancel,
  onConfirm,
}: DeleteSetModalProps) {
  const { t } = useI18n();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!target) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [target, onCancel]);

  if (!target) return null;
  return (
    <div className="modal-overlay" data-testid="delete-set-modal">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-set-title"
      >
        <h2 id="delete-set-title" className="modal-title">
          {target.title}
        </h2>
        <p>
          {t(
            "content.set_status.delete_confirm",
            "The downloaded set and its lessons will be removed from My Content. Your learning progress is kept, and you can download the set again anytime.",
          )}
        </p>
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={deleting}
            data-testid="delete-set-cancel"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
            data-testid="delete-set-confirm"
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
