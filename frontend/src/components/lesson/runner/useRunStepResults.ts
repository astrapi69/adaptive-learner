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
 * round" starts clean. The render that brings the new key already reads
 * the empty map (slice 3): the step-state lock reads the results in that
 * same render, and an Error Replay retry changes the key and the step in
 * one update, so a stale read there would lock a step the new round must
 * present open.
 *
 * @example
 * const runResults = useRunStepResults(source.runKey);
 * const stepState = useLessonStepState({ currentStepIndex, stepId, progress: runResults.progress });
 * onComplete: (scored) => runResults.record(step.id, scored)
 */

import { useCallback, useMemo, useState } from "react";

import type { ExerciseScored } from "../../exercises";
import type { StepResultsSource } from "../../../hooks/lesson/session/useLessonStepState";
import type { LessonStepResultStored } from "../../../storage/types";

export interface RunStepResults {
  /** The results of this run in the shape the step-state lock reads. */
  progress: StepResultsSource;
  /** Keep the graded result of ``stepId`` (a repeat counts one more attempt). */
  record: (stepId: string, scored: ExerciseScored) => void;
}

type StepResultMap = Record<string, LessonStepResultStored>;

/** The results together with the run key they belong to. */
interface KeyedResults {
  key: string;
  results: StepResultMap;
}

const NO_RESULTS: StepResultMap = Object.freeze({}) as StepResultMap;

/** Run-local step results keyed by step id, reset on a new run key. */
export function useRunStepResults(runKey: string): RunStepResults {
  const [keyed, setKeyed] = useState<KeyedResults>({ key: runKey, results: NO_RESULTS });
  const current = keyed.key === runKey;
  if (!current) setKeyed({ key: runKey, results: NO_RESULTS });
  const results = current ? keyed.results : NO_RESULTS;

  // A late result of an earlier run (its closure holds the old key) is
  // dropped: it must not land in the run that replaced it.
  const record = useCallback(
    (stepId: string, scored: ExerciseScored) => {
      setKeyed((prev) => {
        if (prev.key !== runKey) return prev;
        const stored: LessonStepResultStored = {
          correct: scored.correct,
          total: scored.total,
          attempts: (prev.results[stepId]?.attempts ?? 0) + 1,
          completed_at: new Date().toISOString(),
          raw_answer: scored.raw_answer ?? null,
        };
        return { key: runKey, results: { ...prev.results, [stepId]: stored } };
      });
    },
    [runKey],
  );

  const progress = useMemo(() => ({ step_results: results }), [results]);
  return { progress, record };
}
