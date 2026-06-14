/**
 * Lesson viewer header (extracted from LessonPage for the complexity
 * burn-down #417).
 *
 * Renders the pause/back button + exit dialog, the optional set-context
 * line, the lesson title, the optional contributor credit, and the
 * optional description. Behaviour-preserving.
 */

import { Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import LessonExitDialog from "./LessonExitDialog";
import type { ContentLesson } from "../../storage/types";
import { useI18n } from "../../hooks/useI18n";

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

/** Pause button + exit dialog + set/title/credit/description. */
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
        <p className="lesson-header-set" data-testid="lesson-header-set">
          <span className="lesson-header-set-label">
            {t("lesson.set_label", "Set")}:
          </span>
          {setTitle}
        </p>
      )}
      <h1>{lesson.title}</h1>
      {lesson.contributed_by && (
        <p className="lesson-credit" data-testid="lesson-credit">
          {t("lesson.contributed_by", "Contributed by {name}").replace(
            "{name}",
            lesson.contributed_by,
          )}
        </p>
      )}
      {lesson.description && (
        <p className="lesson-description">{lesson.description}</p>
      )}
    </header>
  );
}
