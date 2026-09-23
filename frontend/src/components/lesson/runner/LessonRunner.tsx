/**
 * LessonRunner (EXP-052 slice 1, refs #3169).
 *
 * The one shell every run renders through: source (where the steps
 * come from), policy (what this kind of run shows and allows) and the
 * summary render prop, plus an optional header extension. The shell
 * composes, once, what six pages used to build each for themselves:
 * the status screens, the header, the #959 scroll anchor, the progress
 * bar, the controlled exercise step, the summary at exactly one place,
 * the policy-driven footer, the pinned lesson mode, the two-phase step
 * state with the Enter shortcut, the step and orientation re-anchoring
 * and the per-run hint clear.
 *
 * The three ``true`` literals of the policy (``enterShortcut``,
 * ``reanchor``, ``clearHints``) are not switches: the step-state hook
 * (which owns the Enter listener) is mounted unconditionally, the
 * re-anchor hooks take the literal as their gate, the hint clear runs
 * per run key. What the persisting lesson adds (options bar, theory
 * link, its own chrome) arrives with slice 4.
 *
 * @example
 * <LessonRunner
 *   source={useReviewSource({ setId, limit })}
 *   policy={REVIEW_POLICY}
 *   summary={(tallies) => <ReviewSummaryPanel {...tallies} />}
 * />
 */

import { useEffect, useRef, type ReactNode } from "react";

import { useOrientationReanchor } from "../../../hooks/lesson/interaction/useOrientationReanchor";
import { useStepReanchor } from "../../../hooks/lesson/interaction/useStepReanchor";
import { LessonModeProvider } from "../../../hooks/lesson/modes/useLessonMode";
import { useLessonStepState } from "../../../hooks/lesson/session/useLessonStepState";
import { clearHintUsage } from "../../../lib/hints/hint-usage";
import { isPlayableExerciseStep } from "../../../lib/lesson/lesson-step-state";
import RunnerFooter from "./RunnerFooter";
import RunnerHeader from "./RunnerHeader";
import RunnerProgress from "./RunnerProgress";
import RunnerStatusView, { resolveRunnerStatusKind } from "./RunnerStatusView";
import RunnerStep from "./RunnerStep";
import type {
  RunnerHeaderExtraRenderer,
  RunnerPolicy,
  RunnerSource,
  RunnerSummaryRenderer,
} from "./types";
import { useRunStepResults } from "./useRunStepResults";

export interface LessonRunnerProps {
  source: RunnerSource;
  policy: RunnerPolicy;
  /** Renders the end-of-run summary from the tallies the source reports. */
  summary: RunnerSummaryRenderer;
  /** Optional header extension (transparency block, countdown ring). */
  headerExtra?: RunnerHeaderExtraRenderer;
}

/** The policy's pinned mode around the content; ``"inherit"`` is slice 4's. */
function RunnerMode({ mode, children }: { mode: RunnerPolicy["mode"]; children: ReactNode }) {
  // TODO(#3169) slice 4: the lesson inherits the learner's own choice.
  if (mode === "inherit") return <>{children}</>;
  return <LessonModeProvider mode={mode}>{children}</LessonModeProvider>;
}

/** The runner shell: status view, or the composed frame under ``{prefix}-page``. */
export default function LessonRunner({ source, policy, summary, headerExtra }: LessonRunnerProps) {
  const prefix = policy.testIdPrefix;
  // TODO(#3169) slice 2: a stream source (Endless, position null) needs a
  // step counter of its own for the per-step reset and the re-anchor.
  const index = source.position?.index ?? 0;
  const total = source.position?.total ?? 0;
  const stepId = source.step?.id ?? null;

  // The #1790 lock: the lesson's persisted row, or this run's own results.
  const runResults = useRunStepResults(source.runKey);
  const progress = policy.persistProgress ? (source.progress ?? null) : runResults.progress;
  const {
    exerciseRef,
    answerable,
    setAnswerable,
    checked,
    setChecked,
    enteredReviewed,
    reviewedRaw,
    enterStateRef,
  } = useLessonStepState({ currentStepIndex: index, stepId, progress });

  const stepScrollRef = useRef<HTMLDivElement>(null);
  useStepReanchor(stepScrollRef, index, policy.reanchor);
  useOrientationReanchor(stepScrollRef, policy.reanchor);

  // #594 / #3196: hint usage is per run, cleared when the run starts.
  useEffect(() => {
    clearHintUsage();
  }, [source.runKey]);

  const statusKind = resolveRunnerStatusKind(source.setId !== "", source.status);
  if (statusKind) {
    return (
      <RunnerStatusView
        testIdPrefix={prefix}
        i18nNamespace={policy.i18nNamespace}
        emptyBodyKey={policy.emptyBodyKey}
        loadFailedKey={policy.loadFailedKey}
        notCachedBodyKey={policy.notCachedBodyKey}
        missingParamsKey={policy.missingParamsKey}
        kind={statusKind}
        error={source.error}
      />
    );
  }

  const isExerciseStep = isPlayableExerciseStep(source.step);
  enterStateRef.current = {
    isSummary: source.isSummary,
    isExerciseStep,
    checked,
    enteredReviewed,
    answerable,
    goNext: source.goNext,
  };

  return (
    <main
      id="main"
      className="lesson-page flex flex-col min-h-full"
      data-testid={`${prefix}-page`}
    >
      <RunnerHeader policy={policy} source={source} headerExtra={headerExtra} />
      <div
        ref={stepScrollRef}
        aria-hidden="true"
        className="scroll-mt-4"
        data-testid={`${prefix}-step-anchor`}
      />
      <RunnerProgress testIdPrefix={prefix} position={source.position} isSummary={source.isSummary} />
      <RunnerMode mode={policy.mode}>
        {source.isSummary || source.step === null ? (
          summary(source.tallies)
        ) : (
          <RunnerStep
            key={source.step.id}
            testIdPrefix={prefix}
            step={source.step}
            source={source}
            exerciseRef={exerciseRef}
            enteredReviewed={enteredReviewed}
            reviewedRaw={reviewedRaw}
            stored={progress?.step_results?.[source.step.id]}
            onInteraction={setAnswerable}
            onChecked={() => setChecked(true)}
            onScored={runResults.record}
          />
        )}
      </RunnerMode>
      <RunnerFooter
        policy={policy}
        isSummary={source.isSummary}
        isExerciseStep={isExerciseStep}
        checked={checked}
        enteredReviewed={enteredReviewed}
        answerable={answerable}
        isLastStep={index + 1 === total}
        currentStepIndex={index}
        goPrev={source.goPrev}
        goNext={source.goNext}
        onCheck={() => exerciseRef.current?.submit()}
      />
    </main>
  );
}
