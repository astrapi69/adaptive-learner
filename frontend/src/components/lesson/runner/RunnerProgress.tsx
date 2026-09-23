/**
 * RunnerProgress (EXP-052 slice 1, refs #3169).
 *
 * The one progress bar of the runner shell. The fill percent is
 * computed ONCE here from the source position (the pages used to carry
 * an inline ternary each); the label reads "Step n of m" or "Summary";
 * the track carries ``{prefix}-progress-bar``. Renders through the
 * app-agnostic ``ProgressBar`` with the lesson's token-backed classes,
 * so every runner recolours with the theme.
 *
 * A stream source (Endless, ``position: null``) has no position to fill a
 * bar with, so its progress IS the running tally: the slot renders the
 * stat line instead (time, cards, hit rate; EXP-052 slice 2, Befund 2).
 * No policy column decides this: the variant follows from the source
 * shape, and the stat line is pure display (pause and End live in the
 * footer). It keeps the page's ``{prefix}-stat-line`` testid and reads
 * the runner's own ``stat.*`` keys. On the summary a stream renders
 * nothing here, the recap carries the numbers. The lesson's game-mode
 * checkpoint dots (#2874, ``LessonProgressBar``) arrive with slice 4.
 *
 * @example
 * <RunnerProgress testIdPrefix="review" position={source.position} isSummary={source.isSummary} />
 * <RunnerProgress testIdPrefix="endless" i18nNamespace="endless" position={null}
 *   isSummary={false} tallies={source.tallies} />
 */

import { useI18n } from "../../../hooks/ui/useI18n";
import { formatDuration, hitRatePercent } from "../../../lib/endless/endless-format";
import ProgressBar from "../../../shared/data-display/ProgressBar";
import type { RunnerSource, RunnerTestIdPrefix } from "./types";

export interface RunnerProgressProps {
  testIdPrefix: RunnerTestIdPrefix;
  position: RunnerSource["position"];
  isSummary: boolean;
  /** The runner's own namespace, for the stream stat line's ``stat.*`` keys. */
  i18nNamespace?: string;
  /** The source tallies; a stream's ``stats`` + ``elapsedSec`` feed the stat line. */
  tallies?: RunnerSource["tallies"];
}

interface StreamStatLineProps {
  testIdPrefix: RunnerTestIdPrefix;
  i18nNamespace: string;
  stats: NonNullable<RunnerSource["tallies"]["stats"]>;
  elapsedSec: number;
}

/** ``12:34 | 45 cards | 38 correct (84%)``: the running tally of a stream. */
function StreamStatLine({ testIdPrefix, i18nNamespace, stats, elapsedSec }: StreamStatLineProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-3 px-2 py-1">
      <p
        className="m-0 font-mono text-sm text-fg-primary"
        data-testid={`${testIdPrefix}-stat-line`}
      >
        {formatDuration(elapsedSec)}
        {" | "}
        {t(`${i18nNamespace}.stat.cards`, "{n} cards").replace("{n}", String(stats.cards))}
        {" | "}
        {t(`${i18nNamespace}.stat.correct`, "{n} correct").replace("{n}", String(stats.correct))} (
        {hitRatePercent(stats)}%)
      </p>
    </div>
  );
}

/** Fill percent of an indexed run: the summary and an empty run are full. */
function percentOf(index: number, total: number): number {
  return total === 0 ? 100 : Math.round((index / total) * 100);
}

/** The prefixed step-progress bar ("Step n of m" / "Summary"), or a stream's stat line. */
export default function RunnerProgress({
  testIdPrefix,
  position,
  isSummary,
  i18nNamespace = testIdPrefix,
  tallies,
}: RunnerProgressProps) {
  const { t } = useI18n();
  if (position === null) {
    if (isSummary || !tallies?.stats) return null;
    return (
      <StreamStatLine
        testIdPrefix={testIdPrefix}
        i18nNamespace={i18nNamespace}
        stats={tallies.stats}
        elapsedSec={tallies.elapsedSec ?? 0}
      />
    );
  }
  const label = isSummary
    ? t("lesson.progress.summary", "Summary")
    : t("lesson.progress.step_of", "Step {current} of {total}")
        .replace("{current}", String(position.index + 1))
        .replace("{total}", String(position.total));
  return (
    <ProgressBar
      valueNow={percentOf(position.index, position.total)}
      ariaLabel={t("lesson.progress.aria_label", "Lesson progress")}
      className="lesson-progress-bar"
      fillClassName="lesson-progress-fill"
      labelClassName="lesson-progress-label"
      testId={`${testIdPrefix}-progress-bar`}
    >
      {label}
    </ProgressBar>
  );
}
