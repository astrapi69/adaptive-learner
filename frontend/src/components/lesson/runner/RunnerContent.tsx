/**
 * RunnerContent (EXP-052 slice 2, refs #3169).
 *
 * The slot of the runner shell between the progress row and the footer:
 * the summary render prop on the summary, a notice when a stream has no
 * card right now (``{prefix}-no-card``), otherwise the controlled step.
 * A paused stream keeps its step MOUNTED but hidden behind the
 * ``{prefix}-paused`` notice, so a half-typed answer survives the pause
 * (the old page unmounted it). The step key joins the shell's step
 * counter and the step id, so a stream that repeats a card still
 * remounts a fresh exercise.
 *
 * @example
 * <RunnerContent source={source} policy={ENDLESS_POLICY} summary={renderSummary}
 *   stepIndex={index} stepProps={stepProps} />
 */

import { useI18n } from "../../../hooks/ui/useI18n";
import RunnerNotice from "./RunnerNotice";
import RunnerStep, { type RunnerStepProps } from "./RunnerStep";
import type { RunnerPolicy, RunnerSource, RunnerSummaryRenderer } from "./types";

interface RunnerContentProps {
  source: RunnerSource;
  policy: RunnerPolicy;
  summary: RunnerSummaryRenderer;
  stepIndex: number;
  /** Everything ``RunnerStep`` needs beyond the step, the source and the keys. */
  stepProps: Omit<RunnerStepProps, "testIdPrefix" | "step" | "source" | "hidden" | "stream">;
}

/** The slot between progress and footer: summary, notice, or the step. */
export default function RunnerContent({
  source,
  policy,
  summary,
  stepIndex,
  stepProps,
}: RunnerContentProps) {
  const { t } = useI18n();
  const prefix = policy.testIdPrefix;
  const ns = policy.i18nNamespace;
  if (source.isSummary) return <>{summary(source.tallies)}</>;
  if (source.step === null) {
    return (
      <RunnerNotice
        testId={`${prefix}-no-card`}
        text={t(`${ns}.no_card`, "No more cards right now.")}
      />
    );
  }
  const paused = source.pause?.paused ?? false;
  return (
    <>
      {paused && (
        <RunnerNotice
          testId={`${prefix}-paused`}
          role="status"
          text={t(`${ns}.paused`, "Paused - take a breather.")}
        />
      )}
      <RunnerStep
        key={`${stepIndex}:${source.step.id}`}
        testIdPrefix={prefix}
        step={source.step}
        source={source}
        hidden={paused || undefined}
        stream={source.position === null}
        {...stepProps}
      />
    </>
  );
}
