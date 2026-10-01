/**
 * Step-evaluation insights for browser mode (#3394).
 *
 * TypeScript port of ``aggregate_step_evaluations`` in
 * ``plugins/adaptive-learner-plugin-tracking/adaptive_learner_tracking/summary.py``.
 * API mode returns this slice next to ``tracking``; browser mode wrote the
 * ``stepEvaluations`` rows but never aggregated them, so the Progress page's
 * insights always showed the empty state. Both sides assert against the same
 * goldens in ``tests/fixtures/step-eval-parity/``.
 *
 * @example
 * const slice = aggregateStepEvaluations(rowsForOneProject);
 */

import type { StepEvaluationSummary } from "../../types/domain";

/** The row fields the aggregate reads (a subset of ``StepEvaluationRow``). */
export interface StepEvaluationInput {
  session_id: string;
  from_step: number;
  to_step: number;
  applied: boolean;
  fallback_used: boolean;
  confidence: number;
  evaluated_at: string | null;
}

/** Pauses longer than this are not time spent on a step (Python parity). */
const MAX_STEP_GAP_SECONDS = 2 * 60 * 60;

const round = (value: number, digits: number): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const parseTime = (value: string | null): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
};

function emptySummary(): StepEvaluationSummary {
  return {
    total_evaluations: 0,
    average_confidence: 0,
    advance_count: 0,
    repeat_count: 0,
    backward_count: 0,
    fallback_count: 0,
    evaluations_per_step: {},
    time_seconds_per_step: {},
  };
}

/** Seconds per FROM-step, summed over sessions; the gap between two
 *  consecutive evaluations counts for the earlier one's step. */
function timeSecondsPerStep(bySession: Map<string, StepEvaluationInput[]>): Record<string, number> {
  const seconds: Record<string, number> = {};
  for (const rows of bySession.values()) {
    const ordered = [...rows].sort(
      (a, b) => (parseTime(a.evaluated_at) ?? -Infinity) - (parseTime(b.evaluated_at) ?? -Infinity),
    );
    for (let i = 1; i < ordered.length; i += 1) {
      const prev = parseTime(ordered[i - 1].evaluated_at);
      const curr = parseTime(ordered[i].evaluated_at);
      if (prev === null || curr === null) continue;
      const delta = (curr - prev) / 1000;
      if (delta <= 0 || delta > MAX_STEP_GAP_SECONDS) continue;
      const step = String(ordered[i - 1].from_step);
      seconds[step] = (seconds[step] ?? 0) + delta;
    }
  }
  return Object.fromEntries(Object.entries(seconds).map(([step, s]) => [step, round(s, 2)]));
}

/**
 * Build the ``step_evaluation`` slice from one project's evaluation rows.
 * Counts are mutually exclusive: applied forward moves are advances, applied
 * backward moves are backward, every unapplied verdict is a repeat.
 */
export function aggregateStepEvaluations(rows: readonly StepEvaluationInput[]): StepEvaluationSummary {
  if (rows.length === 0) return emptySummary();
  const summary = emptySummary();
  const confidences: number[] = [];
  const bySession = new Map<string, StepEvaluationInput[]>();
  for (const row of rows) {
    if (typeof row.confidence === "number") confidences.push(row.confidence);
    if (row.applied && row.to_step > row.from_step) summary.advance_count += 1;
    if (row.applied && row.to_step < row.from_step) summary.backward_count += 1;
    if (!row.applied) summary.repeat_count += 1;
    if (row.fallback_used) summary.fallback_count += 1;
    const step = String(row.from_step);
    summary.evaluations_per_step[step] = (summary.evaluations_per_step[step] ?? 0) + 1;
    bySession.set(row.session_id, [...(bySession.get(row.session_id) ?? []), row]);
  }
  summary.total_evaluations = rows.length;
  summary.average_confidence = confidences.length
    ? round(confidences.reduce((sum, c) => sum + c, 0) / confidences.length, 4)
    : 0;
  summary.time_seconds_per_step = timeSecondsPerStep(bySession);
  return summary;
}
