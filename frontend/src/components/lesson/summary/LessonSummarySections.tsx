/**
 * Presentational sections of the lesson-completion summary, split out of
 * LessonSummary.tsx for the complexity burn-down (#1047).
 *
 * Each export is a self-gated, props-driven sub-component: it renders ``null``
 * when its data is absent or not applicable, so the parent JSX drops the
 * matching ``&&`` / ``?:`` guard (which is what drove LessonSummary's
 * cyclomatic complexity). No storage reads here; the only state is the
 * confetti's own self-dismissal.
 */

import { useState } from "react";
import { ClipboardCopy, Download, FileJson, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import AnimatedCounter from "../../../shared/data-display/AnimatedCounter";
import AnswerDiff from "../../../shared/data-display/AnswerDiff";
import Confetti from "../../feedback/Confetti";
import ShareButton from "../../../shared/layout/ShareButton";
import LessonExamResult from "./LessonExamResult";
import { generateShareText } from "../../../lib/share/generate-share-text";
import {
  downloadAnkiDeck,
  lessonCardsToAnki,
} from "../../../lib/export/anki-export";
import { explainError } from "../../../lib/review/explain-error";
import { readExplanationsEnabled } from "../../../lib/review/reviewPref";
import type { StarRating } from "../../../lib/lesson/lesson-summary";
import type { LessonMode } from "../../../lib/learning/lessonModePref";
import type { TimedRunStats } from "../../../lib/learning/timedMode";
import type { ContentLesson, ElementError } from "../../../storage/types";
import { notify } from "../../../utils/notify";

/** The i18n lookup signature the parent passes down. */
type TFn = (key: string, fallback?: string) => string;

/**
 * Perfect-run confetti burst. Owns its self-dismissal so the parent does not
 * thread a ``showConfetti`` state. Renders nothing unless ``active``.
 *
 * @param active - True on a perfect run when the feedback intensity allows it.
 */
export function SummaryConfetti({ active }: { active: boolean }) {
  const [show, setShow] = useState(active);
  if (!active || !show) return null;
  return <Confetti onDone={() => setShow(false)} />;
}

/**
 * The exam-mode result panel (verdict + score + time + XP + retry). Renders
 * ``null`` outside exam mode or on an unscored run.
 */
export function SummaryExamPanel({
  lessonMode,
  total,
  examPass,
  examThreshold,
  correct,
  scorePct,
  minutes,
  xpGain,
  bonusPct,
  onRetry,
}: {
  lessonMode: LessonMode;
  total: number;
  examPass: boolean;
  examThreshold: number;
  correct: number;
  scorePct: number;
  minutes: number;
  xpGain: number;
  bonusPct: number;
  onRetry: () => void;
}) {
  if (lessonMode !== "exam" || total <= 0) return null;
  return (
    <LessonExamResult
      examPass={examPass}
      examThreshold={examThreshold}
      correct={correct}
      total={total}
      scorePct={scorePct}
      minutes={minutes}
      xpGain={xpGain}
      bonusPct={bonusPct}
      onRetry={onRetry}
    />
  );
}

/**
 * The timed-mode timing stats (#1009): answered-in-time, average, and the
 * fastest / slowest question. Renders ``null`` outside timed mode or with no
 * recorded questions.
 */
export function SummaryTimedStats({
  lessonMode,
  timedStats,
  t,
}: {
  lessonMode: LessonMode;
  timedStats: TimedRunStats | null;
  t: TFn;
}) {
  if (lessonMode !== "timed" || !timedStats || timedStats.total <= 0)
    return null;
  return (
    <ul
      className="lesson-summary-stats m-0"
      data-testid="lesson-summary-timed-stats"
    >
      <li>
        {t("lesson.timed.stats_answered", "{n} of {total} answered in time.")
          .replace("{n}", String(timedStats.answeredInTime))
          .replace("{total}", String(timedStats.total))}
      </li>
      <li>
        {t("lesson.timed.stats_avg", "Average answer time: {s}s").replace(
          "{s}",
          String(timedStats.averageSeconds),
        )}
      </li>
      {timedStats.fastest && (
        <li>
          {t("lesson.timed.stats_fastest", "Fastest: {s}s ({type})")
            .replace("{s}", String(timedStats.fastest.seconds))
            .replace(
              "{type}",
              t(
                `lesson.exercise.type_${timedStats.fastest.type}`,
                timedStats.fastest.type,
              ),
            )}
        </li>
      )}
      {timedStats.slowest && (
        <li>
          {t("lesson.timed.stats_slowest", "Slowest: {s}s ({type})")
            .replace("{s}", String(timedStats.slowest.seconds))
            .replace(
              "{type}",
              t(
                `lesson.exercise.type_${timedStats.slowest.type}`,
                timedStats.slowest.type,
              ),
            )}
        </li>
      )}
    </ul>
  );
}

/**
 * The "+N XP" reward badge (#505). Renders ``null`` when the run earned no XP.
 *
 * @param animate - Count the value up (false under the "subtle" intensity).
 */
export function SummaryXp({
  xpGain,
  animate,
  t,
}: {
  xpGain: number;
  animate: boolean;
  t: TFn;
}) {
  if (xpGain <= 0) return null;
  return (
    <div
      className="lesson-summary-xp"
      data-testid="lesson-summary-xp"
      role="status"
      aria-label={t(
        "gamification.xp_gain_aria",
        "You earned {n} XP for this lesson",
      ).replace("{n}", String(xpGain))}
    >
      <span className="lesson-summary-xp-label">
        {t("gamification.xp_earned", "XP earned")}
      </span>
      <span className="lesson-summary-xp-badge">
        <span className="lesson-summary-xp-icon">
          <Zap size={18} aria-hidden="true" />
        </span>
        <AnimatedCounter
          value={xpGain}
          durationMs={1000}
          enabled={animate}
          className="lesson-summary-xp-gain"
          testId="lesson-summary-xp-gain"
          format={(n) => `+${n} ${t("gamification.xp", "XP")}`}
        />
      </span>
    </div>
  );
}

/**
 * Auto-generated explanations + your-vs-correct diff for the run's still-weak
 * text mistakes (#599), gated by the Settings toggle. Renders ``null`` when
 * the toggle is off or there is nothing to explain.
 */
export function SummaryExplanations({
  sessionErrors,
  t,
}: {
  sessionErrors: ElementError[];
  t: TFn;
}) {
  if (!readExplanationsEnabled()) return null;
  const mistakes = sessionErrors
    .filter((e) => !e.mastered && (e.user_answer ?? "").trim() !== "")
    .slice(0, 5);
  if (mistakes.length === 0) return null;
  return (
    <section
      className="lesson-summary-explanations"
      data-testid="lesson-summary-explanations"
    >
      <h3>{t("review.explain_heading", "Why you missed these")}</h3>
      <ul className="flex flex-col gap-3">
        {mistakes.map((err) => {
          const expl = explainError(err);
          return (
            <li
              key={err.id}
              className="flex flex-col gap-1"
              data-testid={`lesson-summary-explain-${err.id}`}
            >
              <AnswerDiff
                userAnswer={err.user_answer}
                correctAnswer={err.correct_answer}
                yourLabel={t("review.your_answer", "Your answer:")}
                correctLabel={t("review.correct_answer", "Correct:")}
              />
              {expl && (
                <p className="text-sm text-fg-muted">
                  {t(expl.key, expl.fallback)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The result-export action row (#138): copy / download Markdown, download
 * JSON, optional Anki-deck export, and a share button on a perfect run. The
 * copy / download / JSON handlers are computed by the parent (which owns the
 * breakdown); the card / star guards live here.
 */
export function SummaryExportActions({
  lesson,
  stars,
  t,
  onCopy,
  onDownload,
  onDownloadJson,
}: {
  lesson: ContentLesson;
  stars: StarRating;
  t: TFn;
  onCopy: () => void;
  onDownload: () => void;
  onDownloadJson: () => void;
}) {
  return (
    <div
      className="lesson-summary-export-actions flex flex-wrap gap-2"
      data-testid="lesson-summary-export"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 gap-2"
        onClick={onCopy}
        data-testid="lesson-summary-copy-result"
      >
        <ClipboardCopy aria-hidden="true" />
        {t("lesson.summary.export.copy", "Copy result")}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 gap-2"
        onClick={onDownload}
        data-testid="lesson-summary-download-result"
      >
        <Download aria-hidden="true" />
        {t("lesson.summary.export.download", "Save as file")}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 gap-2"
        onClick={onDownloadJson}
        data-testid="lesson-summary-download-json"
      >
        <FileJson aria-hidden="true" />
        {t("lesson.summary.export.download_json", "Export as JSON")}
      </Button>
      {lesson.cards.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 gap-2"
          onClick={() =>
            downloadAnkiDeck(lessonCardsToAnki(lesson.cards), lesson.title, {
              deckTags: [lesson.title],
            })
          }
          data-testid="lesson-summary-export-anki"
        >
          <Download aria-hidden="true" />
          {t("lesson.summary.export.anki", "Export cards (Anki)")}
        </Button>
      )}
      {stars === 3 && (
        <ShareButton
          text={generateShareText({ kind: "lesson_complete" }, t).text}
          url={generateShareText({ kind: "lesson_complete" }, t).url}
          label={t("share.achievement.button", "Share")}
          onShared={(how) => {
            if (how === "copied") {
              notify.success(
                t("share.achievement.copied", "Copied to clipboard"),
              );
            }
          }}
          testId="lesson-summary-share"
        />
      )}
    </div>
  );
}
