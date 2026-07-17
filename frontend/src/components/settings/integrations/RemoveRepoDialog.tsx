/**
 * RemoveRepoDialog — confirm removing a connected content repo, with an
 * OPT-IN choice to also delete the learner's progress for that content
 * (#1445 Part B).
 *
 * Default is keep-progress: only the content connection is removed, so
 * re-adding the repo restores the learner's place. That default is named
 * EXPLICITLY (#1651) — while the box is unticked the dialog reassures that
 * progress is kept and reconnecting restores it, so its later return is
 * expected, not a surprise. The opt-in checkbox (never pre-checked) swaps
 * that reassurance for the REAL numbers (from Dexie queries, passed in as
 * ``lessonCount`` / ``cardCount``) and the irreversibility before the learner
 * confirms. The checkbox only appears when there IS progress to delete AND the
 * store supports the local delete (Dexie mode); otherwise the dialog is a
 * plain remove confirm.
 *
 * Wraps the shared {@link ConfirmDialog} (focus trap, Escape, backdrop,
 * restore-focus) so the a11y contract is not re-implemented.
 */

import { useEffect, useId, useState } from "react";

import { useI18n } from "../../../hooks/ui/useI18n";
import ConfirmDialog from "../../../shared/feedback/ConfirmDialog";
import type { DeletionPlan } from "../../../lib/content/browse/orphan-cleanup";
import {
  userRepoSource,
  type UserContentRepo,
} from "../../../lib/content/repos/content-repos";

export interface RemoveRepoDialogProps {
  /** The repo being removed, or ``null`` when the dialog is closed. */
  repo: UserContentRepo | null;
  /** The would-delete plan with real counts (null while it loads). */
  plan: DeletionPlan | null;
  /** Whether the local progress delete is available (Dexie mode). */
  canDeleteProgress: boolean;
  /** Called with whether to also delete progress. */
  onConfirm: (deleteProgress: boolean) => void;
  onCancel: () => void;
}

export default function RemoveRepoDialog({
  repo,
  plan,
  canDeleteProgress,
  onConfirm,
  onCancel,
}: RemoveRepoDialogProps) {
  const { t } = useI18n();
  const [deleteProgress, setDeleteProgress] = useState(false);
  const checkboxId = useId();

  const open = repo !== null;
  const source = repo ? userRepoSource(repo.owner, repo.repo) : "";
  const lessonCount = plan?.lessonCount ?? null;
  const cardCount = plan?.cardCount ?? null;

  // Never carry a ticked box across opens — the safe default is keep.
  useEffect(() => {
    if (open) setDeleteProgress(false);
  }, [open]);

  const hasProgress =
    (lessonCount ?? 0) > 0 || (cardCount ?? 0) > 0;
  const countsKnown = lessonCount !== null && cardCount !== null;
  const showChoice = canDeleteProgress && (hasProgress || !countsKnown);

  const message = t(
    "content_repo.remove.message",
    "Remove {source}? Its downloaded content will be removed from this device.",
  ).replace("{source}", source);

  return (
    <ConfirmDialog
      open={open}
      title={t("content_repo.remove.title", "Remove repository")}
      message={message}
      variant="danger"
      confirmLabel={t("content_repo.action.remove", "Remove")}
      cancelLabel={t("content_repo.action.cancel", "Cancel")}
      // Block confirm only while the checkbox is ticked but the real numbers
      // are still loading — never delete against unknown counts.
      confirmDisabled={deleteProgress && !countsKnown}
      onConfirm={() => onConfirm(showChoice && deleteProgress)}
      onCancel={onCancel}
      testId="content-repo-remove-dialog"
    >
      {showChoice && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
          <label
            htmlFor={checkboxId}
            className="flex items-start gap-2 text-sm text-fg-primary"
          >
            <input
              id={checkboxId}
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--danger)]"
              checked={deleteProgress}
              onChange={(e) => setDeleteProgress(e.target.checked)}
              data-testid="content-repo-remove-delete-progress"
            />
            <span>
              {t(
                "content_repo.remove.delete_progress",
                "Also delete my learning progress for this content.",
              )}
            </span>
          </label>
          {deleteProgress ? (
            <p
              className="m-0 mt-2 text-xs font-medium text-[var(--danger)]"
              role="status"
              data-testid="content-repo-remove-consequence"
            >
              {countsKnown
                ? t(
                    "content_repo.remove.consequence",
                    "{lessons} lessons and {cards} review cards will be deleted. This cannot be undone.",
                  )
                    .replace("{lessons}", String(lessonCount))
                    .replace("{cards}", String(cardCount))
                : t("content_repo.remove.counting", "Counting your progress…")}
            </p>
          ) : (
            // Name the non-destructive default explicitly (#1651): keeping the
            // box unticked disconnects only — the progress stays and reconnecting
            // the repo restores it, so its return later is expected, not a bug.
            <p
              className="m-0 mt-2 text-xs text-fg-secondary"
              role="status"
              data-testid="content-repo-remove-keep"
            >
              {t(
                "content_repo.remove.keep_progress",
                "Your learning progress is kept. Reconnecting this repository restores it.",
              )}
            </p>
          )}
        </div>
      )}
    </ConfirmDialog>
  );
}
