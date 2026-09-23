/**
 * LessonRunner (EXP-052 slice 0, refs #3169).
 *
 * The one shell every run will render through: source (where the steps
 * come from), policy (what this kind of run shows and allows) and the
 * summary render prop, plus an optional header extension. Slice 0
 * ships the frame only: the ``<main>`` with the policy's testid prefix
 * and the #959 scroll-anchor id, composing nothing yet. Slices 1 to 4
 * fill it (status view, header, progress, step state, footer, summary)
 * while migrating one page each; no page renders it before then.
 *
 * @example
 * <LessonRunner
 *   source={useReviewSource({ setId })}
 *   policy={REVIEW_POLICY}
 *   summary={(tallies) => <ReviewSummary {...tallies} />}
 * />
 */

import type {
  RunnerHeaderExtraRenderer,
  RunnerPolicy,
  RunnerSource,
  RunnerSummaryRenderer,
} from "./types";

export interface LessonRunnerProps {
  source: RunnerSource;
  policy: RunnerPolicy;
  /** Renders the end-of-run summary from the tallies the shell collects. */
  summary: RunnerSummaryRenderer;
  /** Optional header extension (transparency block, countdown ring). */
  headerExtra?: RunnerHeaderExtraRenderer;
}

/** The runner frame: ``main#main.lesson-page`` under ``{prefix}-page``. */
export default function LessonRunner({ policy }: LessonRunnerProps) {
  return (
    <main
      id="main"
      className="lesson-page flex flex-col min-h-full"
      data-testid={`${policy.testIdPrefix}-page`}
    />
  );
}
