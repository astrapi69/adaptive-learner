/**
 * LessonStepNav — the two-phase step-navigation footer of a
 * lesson-style player. Renders a "Previous" button plus a single
 * trailing button that shows "Check" while an answerable exercise is
 * still unsubmitted and "Next" / "Finish" otherwise. The trailing
 * button is hidden on the summary screen.
 *
 * App-agnostic and props-driven: every label is supplied via `labels`,
 * the `data-testid` prefix via `testIdPrefix`, and it imports only the
 * shared Button primitive + Lucide icons. Reusable across every
 * lesson / review / error-replay player.
 *
 * @example
 * <LessonStepNav
 *   testIdPrefix="review"
 *   isSummary={isSummary}
 *   isExerciseStep={isExerciseStep}
 *   checked={checked}
 *   answerable={answerable}
 *   isFirstStep={index === 0}
 *   isLastStep={index + 1 === total}
 *   onPrev={goPrev}
 *   onNext={goNext}
 *   onCheck={() => exerciseRef.current?.submit()}
 *   labels={{
 *     navAria: t("lesson.nav.aria_label", "Step navigation"),
 *     prev: t("lesson.action.prev", "Previous"),
 *     check: t("lesson.button.check", "Check"),
 *     checkDisabledHint: t("lesson.button.check_disabled_hint", "Answer the exercise first"),
 *     next: t("lesson.action.next", "Next"),
 *     finish: t("lesson.action.finish", "Finish lesson"),
 *   }}
 * />
 */

import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface LessonStepNavLabels {
  /** Accessible name for the `<nav>`. */
  navAria: string;
  /** "Previous" button label. */
  prev: string;
  /** "Check" button label (unsubmitted answerable exercise). */
  check: string;
  /** Tooltip on the disabled Check button (no answer yet). */
  checkDisabledHint: string;
  /** "Next" button label (non-final step). */
  next: string;
  /** "Finish" button label (final step). */
  finish: string;
}

export interface LessonStepNavProps {
  /** Prefix for the per-button `data-testid`s (`{prefix}-prev` etc.). */
  testIdPrefix: string;
  /** On the summary screen the trailing button is hidden. */
  isSummary: boolean;
  /** The current step is a playable exercise (drives Check vs Next). */
  isExerciseStep: boolean;
  /** The current exercise has been graded (flips Check → Next). */
  checked: boolean;
  /** The current exercise has an answer to check. */
  answerable: boolean;
  /** Disables "Previous" on the first step. */
  isFirstStep: boolean;
  /** The trailing button reads "Finish" instead of "Next". */
  isLastStep: boolean;
  onPrev: () => void;
  onNext: () => void;
  onCheck: () => void;
  labels: LessonStepNavLabels;
}

/** Two-phase (Check → Next/Finish) lesson step navigation footer. */
export default function LessonStepNav({
  testIdPrefix,
  isSummary,
  isExerciseStep,
  checked,
  answerable,
  isFirstStep,
  isLastStep,
  onPrev,
  onNext,
  onCheck,
  labels,
}: LessonStepNavProps) {
  return (
    <nav className="lesson-nav" aria-label={labels.navAria}>
      <Button
        type="button"
        variant="outline"
        className="lesson-nav-prev"
        onClick={onPrev}
        disabled={isFirstStep}
        data-testid={`${testIdPrefix}-prev`}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {labels.prev}
      </Button>
      {!isSummary &&
        (isExerciseStep && !checked ? (
          <Button
            type="button"
            className="lesson-nav-check"
            onClick={onCheck}
            disabled={!answerable}
            title={!answerable ? labels.checkDisabledHint : undefined}
            data-testid={`${testIdPrefix}-check`}
          >
            {labels.check}
          </Button>
        ) : (
          <Button
            type="button"
            className="lesson-nav-next"
            onClick={onNext}
            data-testid={`${testIdPrefix}-next`}
          >
            {isLastStep ? labels.finish : labels.next}
            <ArrowRight size={14} aria-hidden="true" />
          </Button>
        ))}
    </nav>
  );
}
