/**
 * RunnerStep (EXP-052 slice 1, refs #3169).
 *
 * The active exercise step of the runner shell: the controlled
 * ``ExerciseDispatcher`` inside the ``{prefix}-step-{id}`` article the
 * pages render today. ``onComplete`` flips the two-phase button to Next
 * the moment the answer is graded, keeps the graded result in the
 * run-local map (the #1790 lock for a later Previous) and records the
 * hint-stamped element attempts (#594) through the source. A step
 * re-entered with a stored result hands the dispatcher its ``reviewed``
 * raw answer, or the fallback panel when no raw answer exists; the
 * auto-advance is suppressed on such a re-entry (#1921).
 *
 * The lesson-only chrome (theory steps with the back-to-exercise link,
 * the re-read-theory link, Ask-AI, TTS) stays in ``LessonStepView`` and
 * arrives with slice 4.
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
import ReviewedFallbackPanel from "../summary/ReviewedFallbackPanel";
import { stampHintUsage } from "../../../lib/hints/hint-usage";
import type {
  ContentLessonStep,
  LessonStepResultStored,
  RawAnswer,
} from "../../../storage/types";
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
}

/** The prefixed step article around the controlled exercise. */
export default function RunnerStep({
  testIdPrefix,
  step,
  source,
  exerciseRef,
  enteredReviewed,
  reviewedRaw,
  stored,
  onInteraction,
  onChecked,
  onScored,
}: RunnerStepProps) {
  const handleComplete = async (scored: ExerciseScored) => {
    onChecked();
    onScored(step.id, scored);
    await source.recordStepAttempts(stampHintUsage(scored.attempts));
  };

  return (
    <article
      className="lesson-step"
      data-testid={`${testIdPrefix}-step-${step.id}`}
      data-step-type={step.type}
    >
      {step.title && <h2>{step.title}</h2>}
      {enteredReviewed && reviewedRaw === null && step.exercise != null ? (
        <ReviewedFallbackPanel exercise={step.exercise} stored={stored} />
      ) : (
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
      )}
    </article>
  );
}
