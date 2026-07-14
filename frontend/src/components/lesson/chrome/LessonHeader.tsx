/**
 * Synthetic gate-demo marker (#1640): TSDoc-only change to a
 * visual-critical path, used to exercise the visual-baseline gate's
 * FAIL + label-override branches on a throwaway draft PR. Never merged.
 * Lesson viewer header (extracted from LessonPage for the complexity
 * burn-down #417).
 *
 * Renders the pause/back button + exit dialog, the optional small
 * set-context line, the (compact) lesson title, and the optional
 * contributor credit. #1633 — the title is kept as a semantic <h1> but
 * rendered small, and the description subtitle is no longer shown inside
 * the active lesson.
 */

import { Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import LessonExitDialog from "../dialogs/LessonExitDialog";
import type { ContentLesson } from "../../../storage/types";
import { useI18n } from "../../../hooks/ui/useI18n";

interface LessonHeaderProps {
  lesson: ContentLesson;
  setTitle: string | null;
  isInProgress: boolean;
  exitOpen: boolean;
  onPauseClick: () => void;
  onExit: () => void;
  onExitContinue: () => void;
  onExitPause: () => void;
  onExitAbandon: () => void;
}

/** Pause button + exit dialog + compact set/title/credit. */
export default function LessonHeader({
  lesson,
  setTitle,
  isInProgress,
  exitOpen,
  onPauseClick,
  onExit,
  onExitContinue,
  onExitPause,
  onExitAbandon,
}: LessonHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="lesson-header">
      <Button
        type="button"
        variant="ghost"
        className="lesson-back-btn"
        onClick={() => {
          // Phase 63B — only intercept while the lesson is in progress.
          // Completed / abandoned rows behave like before and navigate
          // straight away. Semantically this is PAUSING the lesson (the
          // dialog offers pause/abandon/continue), not just "going back".
          if (isInProgress) {
            onPauseClick();
          } else {
            onExit();
          }
        }}
        data-testid="lesson-back-btn"
        aria-label={t("lesson.action.pause", "Pause lesson")}
        title={t("lesson.action.pause", "Pause lesson")}
      >
        <Pause size={16} aria-hidden="true" />
        <span className="hidden md:inline">
          {t("lesson.action.pause", "Pause lesson")}
        </span>
      </Button>
      <LessonExitDialog
        open={exitOpen}
        onContinue={onExitContinue}
        onPause={onExitPause}
        onAbandon={onExitAbandon}
      />
      {setTitle && (
        // #959 — keep the set context compact (smaller, single line with
        // ellipsis) so it never costs more than one row.
        <p
          className="lesson-header-set truncate text-sm"
          data-testid="lesson-header-set"
        >
          <span className="lesson-header-set-label">
            {t("lesson.set_label", "Set")}:
          </span>
          {setTitle}
        </p>
      )}
      {/* #1633 — the title stays a semantic <h1> (a11y + document structure
          + page heading), but is rendered small/unobtrusive like the set
          label so the big title + description block stops pushing the task
          below the fold on mobile. The set name (collection) and the lesson
          title carry different info, so both stay — just small. The full
          title is still on the set-detail page; the description subtitle is
          dropped from the in-lesson view (it lives on the set-detail
          surfaces). */}
      <h1
        className="truncate text-sm font-medium text-fg-secondary"
        title={lesson.title}
        data-testid="lesson-header-title"
      >
        {lesson.title}
      </h1>
      {lesson.contributed_by && (
        <p className="lesson-credit" data-testid="lesson-credit">
          {t("lesson.contributed_by", "Contributed by {name}").replace(
            "{name}",
            lesson.contributed_by,
          )}
        </p>
      )}
    </header>
  );
}
