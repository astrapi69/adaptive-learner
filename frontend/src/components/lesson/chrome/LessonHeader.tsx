/**
 * Lesson viewer header (extracted from LessonPage for the complexity
 * burn-down #417).
 *
 * Renders the pause/back button + exit dialog, the optional set-context
 * line, the lesson title, the optional contributor credit, and the
 * optional description. Behaviour-preserving.
 */

import { useEffect, useRef, useState } from "react";
import { Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import LessonExitDialog from "../dialogs/LessonExitDialog";
import type { ContentLesson } from "../../../storage/types";
import { useI18n } from "../../../hooks/ui/useI18n";

/**
 * Lesson description clamped to two lines on every viewport with a
 * "show more / less" toggle (#1043). The toggle is shown only when the text
 * actually overflows two lines (measured against the clamped state), so a
 * short description stays a plain paragraph and never costs an extra row.
 *
 * @param text - The lesson description (already known non-empty).
 */
export function LessonDescription({ text }: { text: string }) {
  const { t } = useI18n();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // While clamped, scrollHeight exceeds clientHeight when a third line is
    // needed; that is the only state where the toggle adds value.
    const measure = () =>
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className="lesson-description-wrap">
      <p
        ref={ref}
        className={`lesson-description${expanded ? "" : " line-clamp-2"}`}
        data-testid="lesson-description"
      >
        {text}
      </p>
      {(overflowing || expanded) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="lesson-description-toggle h-auto px-0 text-sm text-fg-muted"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          data-testid="lesson-description-toggle"
        >
          {expanded
            ? t("ui.tooltips.show_less", "Show less")
            : t("ui.tooltips.show_more", "Show more")}
        </Button>
      )}
    </div>
  );
}

interface LessonHeaderProps {
  lesson: ContentLesson;
  setTitle: string | null;
  /** Current step index; the description only shows on the first step. */
  currentStepIndex: number;
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
  currentStepIndex,
  isInProgress,
  exitOpen,
  onPauseClick,
  onExit,
  onExitContinue,
  onExitPause,
  onExitAbandon,
}: LessonHeaderProps) {
  const { t } = useI18n();
  // #959 — the description is read on the first step; from step 2 onward it
  // just eats vertical space and pushes the task below the fold. Show it
  // only on the first step (and never on the summary screen).
  const showDescription = currentStepIndex === 0;

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
      {/* #959 — title on one line with ellipsis; the full title is still
          available on the set detail page + the page <title>. */}
      <h1 className="truncate" title={lesson.title}>
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
      {showDescription && lesson.description && (
        // #959 — first step only. #1043 — clamp to 2 lines on every viewport
        // with a "show more" toggle so even the first step's header stays
        // compact; the full text is one tap away.
        <LessonDescription text={lesson.description} />
      )}
    </header>
  );
}
