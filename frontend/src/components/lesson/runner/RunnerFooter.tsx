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
 * Endless (EXP-052 slice 2, Befund 2) brings the two controls a stream
 * needs: an End button (``policy.endRun``, the only run without a last
 * step) next to the pause, and a TOGGLE pause (``paused`` given): the
 * button pauses and resumes in place (``aria-pressed``, Pause / Play icon,
 * the runner's own ``pause`` / ``resume`` label) instead of opening the
 * lesson's pause dialog, and the action button is hidden while paused.
 * The toggle keeps the ``{prefix}-pause`` testid of the old stat-line
 * toggle (a different control than the dialog's ``{prefix}-pause-btn``),
 * End keeps ``{prefix}-end``.
 * Both belong to a running run, so neither renders on the summary.
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

import { useI18n } from "../../../hooks/ui/useI18n";
import {
  CheckButton,
  EndButton,
  NextButton,
  PauseButton,
  PrevButton,
  TogglePauseButton,
} from "./RunnerFooterButtons";
import type { RunnerPolicy } from "./types";

export interface RunnerFooterProps {
  /** The footer slice of the runner policy. */
  policy: Pick<RunnerPolicy, "testIdPrefix" | "i18nNamespace" | "prevStep" | "pause" | "endRun">;
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
  /** Open the pause / exit dialog; required whenever ``policy.pause`` is set.
   *  With ``paused`` given it toggles pause and resume instead. */
  onPause?: () => void;
  /**
   * Toggle pause (Endless): the run's paused state. Given, the pause
   * control is a pressed / unpressed toggle and the action is hidden while
   * paused; omitted, the pause opens the lesson's pause dialog.
   */
  paused?: boolean;
  /** End the run; required whenever ``policy.endRun`` is set. */
  onEnd?: () => void;
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

/** Policy-driven Previous / pause / Check-Next footer (or the exam forward flow). */
type TestIdOf = (suffix: string) => string;

interface FooterPauseProps {
  props: RunnerFooterProps;
  testId: TestIdOf;
  marginClass: string;
}

/** The lesson's dialog pause, or the Endless toggle when ``paused`` is given. */
function FooterPause({ props, testId, marginClass }: FooterPauseProps) {
  const { policy, paused, onPause, onExit, isInProgress = false } = props;
  if (paused !== undefined) {
    return (
      <TogglePauseButton
        testId={testId("pause")}
        i18nNamespace={policy.i18nNamespace}
        marginClass={marginClass}
        paused={paused}
        onToggle={onPause}
      />
    );
  }
  return (
    <PauseButton
      testId={testId("pause-btn")}
      marginClass={marginClass}
      isInProgress={isInProgress}
      onPause={onPause}
      onExit={onExit}
    />
  );
}

interface FooterActionProps {
  props: RunnerFooterProps;
  testId: TestIdOf;
  className: string;
}

/** The two-phase action: Check while the answer is open, then Next. */
function FooterAction({ props, testId, className }: FooterActionProps) {
  const { isExerciseStep, checked, enteredReviewed, answerable, isLastStep } = props;
  if (isExerciseStep && !checked && !enteredReviewed) {
    return (
      <CheckButton
        testId={testId("check")}
        className={className}
        answerable={answerable}
        onCheck={props.onCheck}
      />
    );
  }
  return (
    <NextButton
      testId={testId("next")}
      className={className}
      isLastStep={isLastStep}
      onClick={props.goNext}
    />
  );
}

/** #1007 Phase 2 exam flow: one forward button that submits and advances. */
function ExamFooter({ props, testId }: { props: RunnerFooterProps; testId: TestIdOf }) {
  const { t } = useI18n();
  const { policy, isExerciseStep, answerable, onSubmitAndAdvance, goNext } = props;
  const advanceExam = isExerciseStep && onSubmitAndAdvance ? onSubmitAndAdvance : goNext;
  return (
    <nav
      className={NAV_CLASS}
      data-testid={testId("footer")}
      aria-label={t("lesson.nav.aria_label", "Step navigation")}
    >
      {policy.pause && <FooterPause props={props} testId={testId} marginClass="mr-auto" />}
      <NextButton
        testId={testId("next")}
        className={actionClass(policy.pause)}
        isLastStep={props.isLastStep}
        onClick={advanceExam}
        gated={isExerciseStep && !answerable}
      />
    </nav>
  );
}

/** Policy-driven Previous / pause / End / Check-Next footer (or the exam forward flow). */
export default function RunnerFooter(props: RunnerFooterProps) {
  const { t } = useI18n();
  const { policy, isSummary, paused } = props;
  const testId: TestIdOf = (suffix) => `${policy.testIdPrefix}-${suffix}`;

  if (props.delayedFeedback && !isSummary) return <ExamFooter props={props} testId={testId} />;

  // A toggle pause and End operate a RUNNING stream; the summary has neither.
  const showPause = policy.pause && !(paused !== undefined && isSummary);
  const showEnd = policy.endRun && !isSummary;
  if (isSummary && !policy.prevStep && !showPause) return null;

  // With End beside it the pause sits at the leading edge and End takes the
  // free space (mr-auto); alone it is centred (mx-auto), as in the lesson.
  return (
    <nav
      className={NAV_CLASS}
      data-testid={testId("footer")}
      aria-label={t("lesson.nav.aria_label", "Step navigation")}
    >
      {policy.prevStep && (
        <PrevButton
          testId={testId("prev")}
          disabled={props.currentStepIndex === 0}
          onClick={props.goPrev}
        />
      )}
      {showPause && (
        <FooterPause props={props} testId={testId} marginClass={showEnd ? "" : "mx-auto"} />
      )}
      {showEnd && (
        <EndButton
          testId={testId("end")}
          i18nNamespace={policy.i18nNamespace}
          onEnd={props.onEnd}
        />
      )}
      {!isSummary && !paused && (
        <FooterAction props={props} testId={testId} className={actionClass(showPause || showEnd)} />
      )}
    </nav>
  );
}
