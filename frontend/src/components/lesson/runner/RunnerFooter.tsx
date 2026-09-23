/**
 * RunnerFooter (EXP-052 slice 0, refs #3169).
 *
 * The sticky step-navigation footer of the runner shell:
 * ``LessonFooterNav`` generalised over the footer part of the policy
 * (``testIdPrefix`` / ``prevStep`` / ``pause``). Every runner gets the
 * lesson look (chevron and check icons, the Previous label hidden on
 * phones) and the #1834 overlap-proof layout: no ``justify-between``,
 * every button ``shrink-0``, the pause centred with an auto-margin that
 * clamps to 0 on overflow so items push apart instead of overlapping
 * under iOS WebKit. Without a pause control the action button takes
 * ``ml-auto`` for the trailing edge instead.
 *
 * Two flows, as in ``LessonFooterNav``: practice (Previous, pause, the
 * two-phase Check / Next button) and the exam delayed-feedback flow
 * (#1007 Phase 2: one submit-and-advance button, forward-only). The
 * action button is hidden on the summary; a summary footer that would
 * carry neither Previous nor pause renders nothing at all.
 *
 * For the lesson policy the markup is byte-identical to
 * ``LessonFooterNav`` (pinned by ``RunnerFooter.test.tsx``); the lesson
 * page keeps its own footer until slice 4 swaps it.
 *
 * @example
 * <RunnerFooter
 *   policy={REVIEW_POLICY}
 *   isSummary={isSummary}
 *   isExerciseStep={isExerciseStep}
 *   checked={checked}
 *   enteredReviewed={false}
 *   answerable={answerable}
 *   isLastStep={isLast}
 *   currentStepIndex={index}
 *   goPrev={goPrev}
 *   goNext={goNext}
 *   onCheck={() => exerciseRef.current?.submit()}
 * />
 */

import { Check, ChevronLeft, ChevronRight, Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../../hooks/ui/useI18n";
import type { RunnerPolicy } from "./types";

export interface RunnerFooterProps {
  /** The footer slice of the runner policy. */
  policy: Pick<RunnerPolicy, "testIdPrefix" | "prevStep" | "pause">;
  isSummary: boolean;
  isExerciseStep: boolean;
  checked: boolean;
  enteredReviewed: boolean;
  answerable: boolean;
  isLastStep: boolean;
  currentStepIndex: number;
  /** #1007 Phase 2 exam flow: single submit-and-advance button, no Previous. */
  delayedFeedback?: boolean;
  /** Pause while in progress, otherwise exit (only read with ``policy.pause``). */
  isInProgress?: boolean;
  /** Required in practice whenever ``policy.prevStep`` is set. */
  goPrev?: () => void;
  goNext: () => void;
  onCheck: () => void;
  /** Open the pause / exit dialog; required whenever ``policy.pause`` is set. */
  onPause?: () => void;
  /** Leave the run; required whenever ``policy.pause`` is set. */
  onExit?: () => void;
  /** Exam flow: submit the current answer AND advance in one click. */
  onSubmitAndAdvance?: () => void;
}

const NAV_CLASS =
  "sticky bottom-0 z-10 mt-4 flex flex-row items-center gap-2 border-t border-border bg-bg-primary pt-3 pb-safe";

/** The trailing action takes the free space itself when no pause centres the row. */
function actionClass(hasPause: boolean): string {
  return hasPause ? "shrink-0" : "ml-auto shrink-0";
}

interface PauseButtonProps {
  testId: string;
  marginClass: string;
  isInProgress: boolean;
  onPause?: () => void;
  onExit?: () => void;
}

function PauseButton({ testId, marginClass, isInProgress, onPause, onExit }: PauseButtonProps) {
  const { t } = useI18n();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`shrink-0 ${marginClass}`}
      onClick={isInProgress ? onPause : onExit}
      data-testid={testId}
      aria-label={t("lesson.action.pause", "Pause lesson")}
      title={t("lesson.action.pause", "Pause lesson")}
    >
      <Pause aria-hidden="true" />
    </Button>
  );
}

interface PrevButtonProps {
  testId: string;
  disabled: boolean;
  onClick?: () => void;
}

function PrevButton({ testId, disabled, onClick }: PrevButtonProps) {
  const { t } = useI18n();
  return (
    <Button
      type="button"
      variant="outline"
      className="min-w-[44px] shrink-0"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-label={t("lesson.action.prev", "Previous")}
      title={t("lesson.action.prev", "Previous")}
    >
      <ChevronLeft size={20} aria-hidden="true" />
      <span className="hidden md:inline">{t("lesson.action.prev", "Previous")}</span>
    </Button>
  );
}

interface CheckButtonProps {
  testId: string;
  className: string;
  answerable: boolean;
  onCheck: () => void;
}

function CheckButton({ testId, className, answerable, onCheck }: CheckButtonProps) {
  const { t } = useI18n();
  return (
    <Button
      type="button"
      className={className}
      onClick={onCheck}
      disabled={!answerable}
      title={
        !answerable
          ? t("lesson.button.check_disabled_hint", "Answer the exercise first")
          : undefined
      }
      data-testid={testId}
    >
      <Check size={20} aria-hidden="true" />
      {t("lesson.button.check", "Check")}
    </Button>
  );
}

interface NextButtonProps {
  testId: string;
  className: string;
  isLastStep: boolean;
  onClick: () => void;
  /** Exam flow: gate the forward button on an answer for an exercise step. */
  gated?: boolean;
}

function NextButton({ testId, className, isLastStep, onClick, gated = false }: NextButtonProps) {
  const { t } = useI18n();
  return (
    <Button
      type="button"
      className={className}
      onClick={onClick}
      disabled={gated}
      title={
        gated ? t("lesson.button.check_disabled_hint", "Answer the exercise first") : undefined
      }
      data-testid={testId}
    >
      {isLastStep ? t("lesson.action.finish", "Finish lesson") : t("lesson.button.next", "Next")}
      <ChevronRight size={20} aria-hidden="true" />
    </Button>
  );
}

/** Policy-driven Previous / pause / Check-Next footer (or the exam forward flow). */
export default function RunnerFooter({
  policy,
  isSummary,
  isExerciseStep,
  checked,
  enteredReviewed,
  answerable,
  isLastStep,
  currentStepIndex,
  delayedFeedback = false,
  isInProgress = false,
  goPrev,
  goNext,
  onCheck,
  onPause,
  onExit,
  onSubmitAndAdvance,
}: RunnerFooterProps) {
  const { t } = useI18n();
  const testId = (suffix: string) => `${policy.testIdPrefix}-${suffix}`;
  const navLabel = t("lesson.nav.aria_label", "Step navigation");
  const pauseProps = { testId: testId("pause-btn"), isInProgress, onPause, onExit };

  if (delayedFeedback && !isSummary) {
    const advanceExam = isExerciseStep && onSubmitAndAdvance ? onSubmitAndAdvance : goNext;
    return (
      <nav className={NAV_CLASS} data-testid={testId("footer")} aria-label={navLabel}>
        {policy.pause && <PauseButton {...pauseProps} marginClass="mr-auto" />}
        <NextButton
          testId={testId("next")}
          className={actionClass(policy.pause)}
          isLastStep={isLastStep}
          onClick={advanceExam}
          gated={isExerciseStep && !answerable}
        />
      </nav>
    );
  }

  if (isSummary && !policy.prevStep && !policy.pause) return null;

  const showCheck = isExerciseStep && !checked && !enteredReviewed;
  return (
    <nav className={NAV_CLASS} data-testid={testId("footer")} aria-label={navLabel}>
      {policy.prevStep && (
        <PrevButton testId={testId("prev")} disabled={currentStepIndex === 0} onClick={goPrev} />
      )}
      {policy.pause && <PauseButton {...pauseProps} marginClass="mx-auto" />}
      {!isSummary &&
        (showCheck ? (
          <CheckButton
            testId={testId("check")}
            className={actionClass(policy.pause)}
            answerable={answerable}
            onCheck={onCheck}
          />
        ) : (
          <NextButton
            testId={testId("next")}
            className={actionClass(policy.pause)}
            isLastStep={isLastStep}
            onClick={goNext}
          />
        ))}
    </nav>
  );
}
