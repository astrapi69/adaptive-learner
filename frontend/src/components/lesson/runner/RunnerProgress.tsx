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
 * A stream source (Endless, ``position: null``) renders nothing here;
 * slice 2 places its stat line in this slot. The lesson's game-mode
 * checkpoint dots (#2874, ``LessonProgressBar``) arrive with slice 4.
 *
 * @example
 * <RunnerProgress testIdPrefix="review" position={source.position} isSummary={source.isSummary} />
 */

import { useI18n } from "../../../hooks/ui/useI18n";
import ProgressBar from "../../../shared/data-display/ProgressBar";
import type { RunnerSource, RunnerTestIdPrefix } from "./types";

export interface RunnerProgressProps {
  testIdPrefix: RunnerTestIdPrefix;
  position: RunnerSource["position"];
  isSummary: boolean;
}

/** Fill percent of an indexed run: the summary and an empty run are full. */
function percentOf(index: number, total: number): number {
  return total === 0 ? 100 : Math.round((index / total) * 100);
}

/** The prefixed step-progress bar with its "Step n of m" / "Summary" label. */
export default function RunnerProgress({ testIdPrefix, position, isSummary }: RunnerProgressProps) {
  const { t } = useI18n();
  // TODO(#3169) slice 2: the Endless stat line (time, cards, hit rate)
  // renders in this slot for a stream source.
  if (position === null) return null;
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
