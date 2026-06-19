/**
 * Sticky step-navigation footer (extracted from LessonPage for the
 * complexity burn-down #417).
 *
 * Renders the Previous button plus the two-phase action button: on an
 * unchecked exercise step it shows "Check" (gated by ``answerable``),
 * otherwise "Next" / "Finish lesson". The action button is hidden on
 * the summary screen.
 */

import { Check, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../hooks/ui/useI18n";

interface LessonFooterNavProps {
  isSummary: boolean;
  isExerciseStep: boolean;
  checked: boolean;
  enteredReviewed: boolean;
  answerable: boolean;
  isLastStep: boolean;
  currentStepIndex: number;
  goPrev: () => void;
  goNext: () => void;
  onCheck: () => void;
}

/** Previous button + the two-phase Check/Next button. */
export default function LessonFooterNav({
  isSummary,
  isExerciseStep,
  checked,
  enteredReviewed,
  answerable,
  isLastStep,
  currentStepIndex,
  goPrev,
  goNext,
  onCheck,
}: LessonFooterNavProps) {
  const { t } = useI18n();
  const showCheck = isExerciseStep && !checked && !enteredReviewed;

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
