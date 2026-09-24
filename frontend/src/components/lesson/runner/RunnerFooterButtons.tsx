/**
 * The buttons of ``RunnerFooter`` (EXP-052, refs #3169), split out so the
 * footer itself stays one concern (the row layout per flow and policy).
 * Presentational only: labels come from the shared ``lesson.*`` footer
 * keys, and for the two Endless-only controls (toggle pause, End) from the
 * runner's own namespace, the keys the old stat line already read.
 *
 * @example
 * <PrevButton testId="review-prev" disabled={index === 0} onClick={goPrev} />
 */

import { Check, ChevronLeft, ChevronRight, Pause, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../../hooks/ui/useI18n";

/** ``shrink-0`` plus an optional auto margin (no trailing space when empty). */
function withMargin(marginClass: string): string {
  return marginClass ? `shrink-0 ${marginClass}` : "shrink-0";
}

interface PauseButtonProps {
  testId: string;
  marginClass: string;
  isInProgress: boolean;
  onPause?: () => void;
  onExit?: () => void;
}

interface TogglePauseButtonProps {
  testId: string;
  i18nNamespace: string;
  marginClass: string;
  paused: boolean;
  onToggle?: () => void;
}

/** The Endless pause: pauses and resumes in place, pressed while paused. */
export function TogglePauseButton({
  testId,
  i18nNamespace,
  marginClass,
  paused,
  onToggle,
}: TogglePauseButtonProps) {
  const { t } = useI18n();
  const label = paused
    ? t(`${i18nNamespace}.resume`, "Resume")
    : t(`${i18nNamespace}.pause`, "Pause");
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={withMargin(marginClass)}
      onClick={onToggle}
      data-testid={testId}
      aria-pressed={paused}
      aria-label={label}
      title={label}
    >
      {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
    </Button>
  );
}

interface EndButtonProps {
  testId: string;
  i18nNamespace: string;
  onEnd?: () => void;
}

/** End the stream (Endless): the recap follows, as the old stat-line End did. */
export function EndButton({ testId, i18nNamespace, onEnd }: EndButtonProps) {
  const { t } = useI18n();
  const label = t(`${i18nNamespace}.end`, "End");
  return (
    <Button
      type="button"
      variant="outline"
      className="mr-auto min-w-[44px] shrink-0"
      onClick={onEnd}
      data-testid={testId}
      aria-label={label}
      title={label}
    >
      <Square size={16} aria-hidden="true" />
      <span className="hidden md:inline">{label}</span>
    </Button>
  );
}

export function PauseButton({
  testId,
  marginClass,
  isInProgress,
  onPause,
  onExit,
}: PauseButtonProps) {
  const { t } = useI18n();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={withMargin(marginClass)}
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

export function PrevButton({ testId, disabled, onClick }: PrevButtonProps) {
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

export function CheckButton({ testId, className, answerable, onCheck }: CheckButtonProps) {
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

export function NextButton({
  testId,
  className,
  isLastStep,
  onClick,
  gated = false,
}: NextButtonProps) {
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
