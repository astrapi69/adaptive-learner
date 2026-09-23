/**
 * EndlessSummary (EXP-052 slice 2, refs #3169).
 *
 * The Endless recap, hung into ``LessonRunner`` through its ``summary``
 * render prop once the learner ends the stream: duration, cards, correct
 * with hit rate, reviews done, new learned, errors practised and practice
 * XP, then the sole exit. Moved out of ``pages/lesson/EndlessLesson.tsx``
 * with its testids (``endless-summary``, ``endless-summary-{row}``,
 * ``endless-summary-exit``). It no longer wraps itself in a ``<main>``:
 * the page used to return it early INSTEAD of the run screen (two
 * mutually exclusive ``<main>`` elements in one file, code duplication
 * rather than a doubled landmark), now the shell's ``<main>`` holds it.
 * The exit keeps its auto-focus (#1864): the sole next step, so Enter
 * activates it natively.
 *
 * @example
 * summary={(tallies) => (
 *   <EndlessSummary stats={tallies.stats!} elapsedSec={tallies.elapsedSec ?? 0}
 *     onExit={() => navigate("/dashboard")} />
 * )}
 */

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EndlessStats } from "../../../../hooks/lesson/modes/useEndlessLesson";
import { useI18n } from "../../../../hooks/ui/useI18n";
import { formatDuration, hitRatePercent } from "../../../../lib/endless/endless-format";

export interface EndlessSummaryProps {
  stats: EndlessStats;
  elapsedSec: number;
  onExit: () => void;
}

/** End-of-session recap: duration + the running counters + exit. */
export default function EndlessSummary({ stats, elapsedSec, onExit }: EndlessSummaryProps) {
  const { t } = useI18n();
  const rows: Array<[string, string, string]> = [
    ["duration", t("endless.summary.duration", "Duration"), formatDuration(elapsedSec)],
    ["cards", t("endless.summary.cards", "Cards"), `${stats.cards}`],
    [
      "correct",
      t("endless.summary.correct", "Correct"),
      `${stats.correct} (${hitRatePercent(stats)}%)`,
    ],
    ["reviews", t("endless.summary.reviews", "Reviews done"), `${stats.reviewsDone}`],
    ["new", t("endless.summary.new", "New learned"), `${stats.newLearned}`],
    ["errors", t("endless.summary.errors", "Errors practised"), `${stats.errorsPracticed}`],
    ["xp", t("endless.summary.xp", "Practice XP"), `${stats.xp}`],
  ];
  return (
    <section
      className="lesson-summary"
      data-testid="endless-summary"
      aria-label={t("endless.summary.heading", "Practice session complete!")}
    >
      <h2>{t("endless.summary.heading", "Practice session complete!")}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {rows.map(([key, label, value]) => (
          <div key={key} className="contents">
            <dt className="text-fg-muted">{label}</dt>
            <dd
              className="m-0 font-semibold text-fg-primary"
              data-testid={`endless-summary-${key}`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          autoFocus
          onClick={onExit}
          data-testid="endless-summary-exit"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {t("endless.back_to_dashboard", "Back to Dashboard")}
        </Button>
      </div>
    </section>
  );
}
