/**
 * Delete-confirm modal for a user-generated set on the /content page
 * (Phase 59C, extracted from Content.tsx, #896).
 *
 * Renders nothing when there is no target. Presentational: the page owns
 * the target + the deleting flag + the confirm/cancel handlers.
 * Behaviour-preserving: identical testids, text, and disabled states.
 */

import { Button } from "@/components/ui/button";
import { ModalCard, ModalOverlay, ModalTitle } from "@/shared/modal";

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
    <ModalOverlay data-testid="my-lesson-delete-modal">
      <ModalCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-lesson-title"
      >
        <ModalTitle id="delete-lesson-title">
          {target.title}
        </ModalTitle>
        <p>
          {t("content.my_lessons.delete_confirm", "Delete this lesson? This cannot be undone.")}
        </p>
        <div className="mt-4 flex justify-end gap-3 max-[769px]:flex-col max-[769px]:items-stretch max-[769px]:gap-2">
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
      </ModalCard>
    </ModalOverlay>
  );
}
