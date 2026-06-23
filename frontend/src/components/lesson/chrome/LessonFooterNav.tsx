/**
 * Sticky step-navigation footer (extracted from LessonPage for the
 * complexity burn-down #417).
 *
 * Two flows:
 * - Practice / timed (immediate feedback): the Previous button plus the
 *   two-phase action button — "Check" (gated by ``answerable``) on an
 *   unchecked exercise step, otherwise "Next" / "Finish lesson".
 * - Exam (``delayedFeedback``, #1007 Phase 2): a SINGLE forward button
 *   that submits the current answer and advances in one click (no
 *   intermediate graded review — correctness is revealed only at the end),
 *   and NO Previous button (forward-only until completion). The action
 *   button is hidden on the summary screen in both flows.
 */

import { Check, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../../hooks/ui/useI18n";

interface LessonFooterNavProps {
  isSummary: boolean;
  isExerciseStep: boolean;
  checked: boolean;
  enteredReviewed: boolean;
  answerable: boolean;
  isLastStep: boolean;
  currentStepIndex: number;
  /** #1007 Phase 2 — exam delayed-feedback flow: single submit+advance
   *  button, no Previous (forward-only). */
  delayedFeedback?: boolean;
  goPrev: () => void;
  goNext: () => void;
  onCheck: () => void;
  /** #1007 Phase 2 — submit the current answer AND advance in one click
   *  (exam flow). Required when ``delayedFeedback`` is set. */
  onSubmitAndAdvance?: () => void;
}

/** Previous button + the two-phase Check/Next button (or the exam
 *  single-button forward flow when ``delayedFeedback`` is set). */
export default function LessonFooterNav({
  isSummary,
  isExerciseStep,
  checked,
  enteredReviewed,
  answerable,
  isLastStep,
  currentStepIndex,
  delayedFeedback = false,
  goPrev,
  goNext,
  onCheck,
  onSubmitAndAdvance,
}: LessonFooterNavProps) {
  const { t } = useI18n();
  const showCheck = isExerciseStep && !checked && !enteredReviewed;

  // Exam delayed-feedback flow (#1007 Phase 2): one forward button that
  // submits + advances, forward-only (no Previous). On an exercise step it
  // commits the answer (gated by ``answerable``); on a non-exercise
  // (theory) step it just advances.
  if (delayedFeedback && !isSummary) {
    const advanceExam =
      isExerciseStep && onSubmitAndAdvance ? onSubmitAndAdvance : goNext;
    return (
      <nav
        className="sticky bottom-0 z-10 mt-4 flex flex-row items-center gap-2 border-t border-border bg-bg-primary py-3"
        data-testid="lesson-footer"
        aria-label={t("lesson.nav.aria_label", "Step navigation")}
      >
        <Button
          type="button"
          className="ml-auto"
          onClick={advanceExam}
          disabled={isExerciseStep && !answerable}
          title={
            isExerciseStep && !answerable
              ? t(
                  "lesson.button.check_disabled_hint",
                  "Answer the exercise first",
                )
              : undefined
          }
          data-testid="lesson-next"
        >
          {isLastStep
            ? t("lesson.action.finish", "Finish lesson")
            : t("lesson.button.next", "Next")}
          <ChevronRight size={20} aria-hidden="true" />
        </Button>
      </nav>
    );
  }

  return (
    <nav
      className="sticky bottom-0 z-10 mt-4 flex flex-row items-center gap-2 border-t border-border bg-bg-primary py-3"
      data-testid="lesson-footer"
      aria-label={t("lesson.nav.aria_label", "Step navigation")}
    >
      <Button
        type="button"
        variant="outline"
        className="min-w-[44px]"
        onClick={goPrev}
        disabled={currentStepIndex === 0}
        data-testid="lesson-prev"
        aria-label={t("lesson.action.prev", "Previous")}
        title={t("lesson.action.prev", "Previous")}
      >
        <ChevronLeft size={20} aria-hidden="true" />
        <span className="hidden md:inline">
          {t("lesson.action.prev", "Previous")}
        </span>
      </Button>
      {!isSummary &&
        (showCheck ? (
          <Button
            type="button"
            className="ml-auto"
            onClick={onCheck}
            disabled={!answerable}
            title={
              !answerable
                ? t(
                    "lesson.button.check_disabled_hint",
                    "Answer the exercise first",
                  )
                : undefined
            }
            data-testid="lesson-check"
          >
            <Check size={20} aria-hidden="true" />
            {t("lesson.button.check", "Check")}
          </Button>
        ) : (
          <Button
            type="button"
            className="ml-auto"
            onClick={goNext}
            data-testid="lesson-next"
          >
            {isLastStep
              ? t("lesson.action.finish", "Finish lesson")
              : t("lesson.button.next", "Next")}
            <ChevronRight size={20} aria-hidden="true" />
          </Button>
        ))}
    </nav>
  );
}
