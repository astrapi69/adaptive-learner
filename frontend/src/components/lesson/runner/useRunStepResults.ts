/**
 * useRunStepResults (EXP-052 slice 1, refs #3169).
 *
 * The run-local step results of an ephemeral runner (review, shuffle,
 * endless, adaptive, error replay): nothing is persisted, but the
 * results of THIS run feed ``useLessonStepState`` as its
 * ``StepResultsSource``, so a step re-entered through Previous renders
 * locked (#1790) and its element is not recorded a second time. The
 * lesson keeps its persisted ``LessonProgress`` row instead.
 *
 * A new ``runKey`` drops the map (render-phase reset, the same "adjust
 * state on prop change" pattern as the step-state hook), so "another
 * round" starts clean.
 *
 * @example
 * const runResults = useRunStepResults(source.runKey);
 * const stepState = useLessonStepState({ currentStepIndex, stepId, progress: runResults.progress });
 * onComplete: (scored) => runResults.record(step.id, scored)
 */

import { useCallback, useMemo, useRef, useState } from "react";

import type { ExerciseScored } from "../../exercises";
import type { StepResultsSource } from "../../../hooks/lesson/session/useLessonStepState";
import type { LessonStepResultStored } from "../../../storage/types";

export interface RunStepResults {
  /** The results of this run in the shape the step-state lock reads. */
  progress: StepResultsSource;
  /** Keep the graded result of ``stepId`` (a repeat counts one more attempt). */
  record: (stepId: string, scored: ExerciseScored) => void;
}

/** Run-local step results keyed by step id, reset on a new run key. */
export function useRunStepResults(runKey: string): RunStepResults {
  const [results, setResults] = useState<Record<string, LessonStepResultStored>>({});
  const prevRunKeyRef = useRef(runKey);
  if (prevRunKeyRef.current !== runKey) {
    prevRunKeyRef.current = runKey;
    setResults({});
  }

  const record = useCallback((stepId: string, scored: ExerciseScored) => {
    setResults((prev) => ({
      ...prev,
      [stepId]: {
        correct: scored.correct,
        total: scored.total,
        attempts: (prev[stepId]?.attempts ?? 0) + 1,
        completed_at: new Date().toISOString(),
        raw_answer: scored.raw_answer ?? null,
      },
    }));
  }, []);

  const progress = useMemo(() => ({ step_results: results }), [results]);
  return { progress, record };
}
