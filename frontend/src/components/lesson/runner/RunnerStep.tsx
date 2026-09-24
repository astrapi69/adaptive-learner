/**
 * RunnerStep (EXP-052 slice 1, refs #3169).
 *
 * The active step of the runner shell. An exercise step is the controlled
 * ``ExerciseDispatcher`` inside the ``{prefix}-step-{id}`` article the
 * pages render today. ``onComplete`` flips the two-phase button to Next
 * the moment the answer is graded, keeps the graded result in the
 * run-local map (the #1790 lock for a later Previous) and records the
 * hint-stamped element attempts (#594) through the source. A step
 * re-entered with a stored result hands the dispatcher its ``reviewed``
 * raw answer, or the fallback panel when no raw answer exists; the
 * auto-advance is suppressed on such a re-entry (#1921).
 *
 * A theory step (the adaptive lesson opens on one it borrows from the
 * source lesson, #3224) renders its authored content through
 * ``TheoryBody`` under ``{prefix}-theory-body``, never through the
 * dispatcher, which would read it as an exercise missing its type. The
 * step type decides, here and only here; the footer already shows Next
 * alone for it (``isPlayableExerciseStep`` is false). The lesson-only
 * chrome around theory and exercises (the back-to-exercise link, the
 * re-read-theory link, Ask-AI, TTS, step-anchor navigation) stays in
 * ``LessonStepView`` and arrives with slice 4.
 *
 * @example
 * <RunnerStep
 *   key={step.id}
 *   testIdPrefix="review"
 *   step={step}
 *   source={source}
 *   exerciseRef={exerciseRef}
 *   enteredReviewed={enteredReviewed}
 *   reviewedRaw={reviewedRaw}
 *   stored={runResults.progress.step_results[step.id]}
 *   onInteraction={setAnswerable}
 *   onChecked={() => setChecked(true)}
 *   onScored={runResults.record}
 * />
 */

import type { Ref } from "react";

import { AutoAdvanceSuppressedProvider } from "../../exercises/feedback/auto-advance-gate";
import { ExerciseDispatcher } from "../../exercises";
import type { ExerciseHandle, ExerciseScored } from "../../exercises";
import TheoryBody from "../steps/TheoryBody";
import ReviewedFallbackPanel from "../summary/ReviewedFallbackPanel";
import { stampHintUsage } from "../../../lib/hints/hint-usage";
import type { ContentLessonStep, LessonStepResultStored, RawAnswer } from "../../../storage/types";
import type { RunnerSource, RunnerTestIdPrefix } from "./types";

export interface RunnerStepProps {
  testIdPrefix: RunnerTestIdPrefix;
  step: ContentLessonStep;
  source: Pick<RunnerSource, "setId" | "lessonId" | "cards" | "recordStepAttempts">;
  exerciseRef: Ref<ExerciseHandle>;
  enteredReviewed: boolean;
  reviewedRaw: RawAnswer | null;
  /** The run-local result of this step, for the fallback panel. */
  stored: LessonStepResultStored | undefined;
  onInteraction: (answerable: boolean) => void;
  onChecked: () => void;
  onScored: (stepId: string, scored: ExerciseScored) => void;
  /** A paused stream (slice 2): the step stays mounted, so a half-typed
   *  answer survives the pause, but is hidden behind the paused notice. */
  hidden?: boolean;
  /** A stream step (Endless): the testid carries no step id, because a
   *  stream repeats cards and the page has always rendered ``{prefix}-step``. */
  stream?: boolean;
}

/** Which renderer a step goes to: the step type decides (#3224). */
function isTheoryStep(step: ContentLessonStep): boolean {
  return step.type === "theory";
}

type RunnerExerciseProps = Omit<RunnerStepProps, "testIdPrefix" | "hidden" | "stream">;

/**
 * The exercise branch: the controlled dispatcher, or the fallback panel for
 * a locked re-entry without a raw answer.
 */
function RunnerExercise({
  step,
  source,
  exerciseRef,
  enteredReviewed,
  reviewedRaw,
  stored,
  onInteraction,
  onChecked,
  onScored,
}: RunnerExerciseProps) {
  const handleComplete = async (scored: ExerciseScored) => {
    onChecked();
    onScored(step.id, scored);
    await source.recordStepAttempts(stampHintUsage(scored.attempts));
  };

  if (enteredReviewed && reviewedRaw === null && step.exercise != null) {
    return <ReviewedFallbackPanel exercise={step.exercise} stored={stored} />;
  }
  return (
    <AutoAdvanceSuppressedProvider suppressed={enteredReviewed}>
      <ExerciseDispatcher
        ref={exerciseRef}
        controlled
        onInteraction={onInteraction}
        reviewed={reviewedRaw}
        step={step}
        setId={source.setId}
        lessonId={source.lessonId}
        cards={source.cards}
        onComplete={handleComplete}
      />
    </AutoAdvanceSuppressedProvider>
  );
}

/** The prefixed step article around the theory content or the controlled exercise. */
export default function RunnerStep({
  testIdPrefix,
  hidden,
  stream = false,
  ...exerciseProps
}: RunnerStepProps) {
  const { step } = exerciseProps;
  return (
    <article
      className="lesson-step"
      hidden={hidden}
      data-testid={stream ? `${testIdPrefix}-step` : `${testIdPrefix}-step-${step.id}`}
      data-step-type={step.type}
    >
      {step.title && <h2>{step.title}</h2>}
      {isTheoryStep(step) ? (
        <TheoryBody
          testId={`${testIdPrefix}-theory-body`}
          body={step.body ?? ""}
          exampleUrl={step.example_url}
          exampleLabel={step.example_label}
          examples={step.examples}
        />
      ) : (
        <RunnerExercise {...exerciseProps} />
      )}
    </article>
  );
}
