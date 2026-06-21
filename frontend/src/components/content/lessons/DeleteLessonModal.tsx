/**
 * Delete-confirm modal for a user-generated set on the /content page
 * (Phase 59C, extracted from Content.tsx, #896).
 *
 * Renders nothing when there is no target. Presentational: the page owns
 * the target + the deleting flag + the confirm/cancel handlers.
 * Behaviour-preserving: identical testids, text, and disabled states.
 */

import { Button } from "@/components/ui/button";

import { useI18n } from "../../../hooks/ui/useI18n";
import type { ContentSetEntry } from "../../../storage/types";

interface DeleteLessonModalProps {
  target: ContentSetEntry | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** The /content My-Lessons delete-confirm modal. */
export default function DeleteLessonModal({
  target,
  deleting,
  onCancel,
  onConfirm,
}: DeleteLessonModalProps) {
  const { t } = useI18n();
  if (!target) return null;
  return (
    <div className="modal-overlay" data-testid="my-lesson-delete-modal">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-lesson-title"
      >
        <h2 id="delete-lesson-title" className="modal-title">
          {target.title}
        </h2>
        <p>
          {t("content.my_lessons.delete_confirm", "Delete this lesson? This cannot be undone.")}
        </p>
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={deleting}
            data-testid="my-lesson-delete-cancel"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
            data-testid="my-lesson-delete-confirm"
          >
            {deleting
              ? t("common.loading", "Loading…")
              : t("content.my_lessons.delete", "Delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
