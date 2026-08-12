/**
 * Presentational sections of the lesson-completion summary, split out of
 * LessonSummary.tsx for the complexity burn-down (#1047).
 *
 * Each export is a self-gated, props-driven sub-component: it renders ``null``
 * when its data is absent or not applicable, so the parent JSX drops the
 * matching ``&&`` / ``?:`` guard (which is what drove LessonSummary's
 * cyclomatic complexity). No storage reads here; the only state is the
 * confetti's own self-dismissal.
 *
 * #1411 — the configurable sections additionally take an ``enabled`` flag
 * (from the ``summarySectionsPref`` settings object) and self-gate on it,
 * so the parent stays flat while every section is user-toggleable.
 */

import { useState } from "react";
import { ClipboardCopy, Download, FileJson, Star, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import AnimatedCounter from "../../../shared/data-display/AnimatedCounter";
import AnswerDiff from "../../../shared/data-display/AnswerDiff";
import Confetti from "../../feedback/Confetti";
import LessonExamResult from "./LessonExamResult";
import LessonFavoriteToggle from "../chrome/LessonFavoriteToggle";
import ShareResultButton, {
  type ShareResultButtonProps,
} from "../../share/ShareResultButton";
import {
  downloadAnkiDeck,
  lessonCardsToAnki,
} from "../../../lib/export/anki-export";
import { explainError } from "../../../lib/review/explain-error";
import { readExplanationsEnabled } from "../../../lib/review/reviewPref";
import type { LessonMode } from "../../../lib/learning/lessonModePref";
import type { TimedRunStats } from "../../../lib/learning/timedMode";
import type { StarRating } from "../../../lib/lesson/lesson-summary";
import type { ContentLesson, ElementError } from "../../../storage/types";

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
 * The save-to-favorites hint row (#1411 toggleable). Renders ``null`` when
 * the section is disabled or the run is anonymous.
 */
export function SummaryFavorite({
  enabled,
  userId,
  source,
  setId,
  setTitle,
  filename,
  title,
  t,
}: {
  enabled: boolean;
  userId: string;
  source: string;
  setId: string;
  setTitle: string;
  filename: string;
  title: string;
  t: TFn;
}) {
  if (!enabled || !userId) return null;
  return (
    <div
      className="flex items-center gap-1"
      data-testid="lesson-summary-favorite"
    >
      <LessonFavoriteToggle
        userId={userId}
        source={source}
        setId={setId}
        filename={filename}
        title={title}
        setTitle={setTitle}
        size={16}
      />
      <span className="text-sm text-fg-muted">
        {t("favorites.save_prompt", "Save this lesson to your favorites")}
      </span>
    </div>
  );
}

/**
 * The result scoreboard: the 0-3 star row, the encouraging headline message
 * and the count-up score bar (#1411 toggleable, part of "Result and
 * statistics" together with {@link SummaryStatsList}).
 *
 * #2479 — the score bar is two-segment: a solid "immediate" fill (correct on
 * the first pass) and a hatched "corrected" fill (previously-wrong elements
 * fixed in the correction round). The two segments are distinguished by a
 * diagonal hatch AND a labelled legend, never by colour alone. When nothing
 * was corrected (``correctedCount === 0``) the bar renders as a single solid
 * fill with no legend, so a run without a correction round looks unchanged.
 * The stars + message follow the correction-adjusted final state.
 */
export function SummaryScoreboard({
  enabled,
  stars,
  message,
  animatedPct,
  scorePct,
  correct,
  total,
  immediateCorrect,
  correctedCount,
  immediatePct,
  t,
}: {
  enabled: boolean;
  stars: StarRating;
  message: string;
  animatedPct: number;
  scorePct: number;
  correct: number;
  total: number;
  /** Correct on the first pass (#2479); drives the solid segment's width. */
  immediateCorrect: number;
  /** Previously-wrong elements corrected (#2479); drives the hatched
   *  segment. 0 => single-segment bar, no legend. */
  correctedCount: number;
  /** First-pass percentage: the immediate segment's width AND the corrected
   *  segment's left offset (it stacks straight after). */
  immediatePct: number;
  t: TFn;
}) {
  if (!enabled) return null;
  const hasCorrections = correctedCount > 0;
  // The animated count-up runs on the FINAL percentage; split it across the
  // two segments so the immediate segment never overshoots its own share.
  const animatedImmediatePct = Math.min(animatedPct, immediatePct);
  const animatedCorrectedPct = Math.max(0, animatedPct - immediatePct);
  const barAria = hasCorrections
    ? t(
        "lesson.summary.score_bar_aria_corrected",
        "Score: {pct} percent, of which {corrected} fixed after correction",
      )
        .replace("{pct}", String(scorePct))
        .replace("{corrected}", String(correctedCount))
    : t("lesson.summary.score_bar_aria", "Score: {pct} percent").replace(
        "{pct}",
        String(scorePct),
      );
  return (
    <>
      <div
        className="lesson-summary-stars"
        data-testid="lesson-summary-stars"
        role="img"
        aria-label={t("lesson.summary.stars_aria", "{n} of 3 stars").replace(
          "{n}",
          String(stars),
        )}
      >
        {[1, 2, 3].map((n) => {
          const earned = n <= stars;
          return (
            <Star
              key={n}
              size={28}
              aria-hidden="true"
              className={`lesson-summary-star${earned ? " is-earned" : ""}`}
              fill={earned ? "currentColor" : "none"}
              data-earned={earned ? "true" : "false"}
              data-testid={`lesson-summary-star-${n}`}
            />
          );
        })}
      </div>

      <p
        className="lesson-summary-message"
        data-testid="lesson-summary-message"
        data-stars={String(stars)}
      >
        {message}
      </p>

      <div
        className="lesson-summary-score-bar"
        role="progressbar"
        aria-valuenow={scorePct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={barAria}
        data-testid="lesson-summary-score-bar"
        data-has-corrections={hasCorrections ? "true" : "false"}
      >
        <div
          className="lesson-summary-score-fill lesson-summary-score-fill-immediate"
          style={{ width: `${animatedImmediatePct}%` }}
          data-testid="lesson-summary-score-fill-immediate"
        />
        {hasCorrections && (
          <div
            className="lesson-summary-score-fill lesson-summary-score-fill-corrected"
            style={{
              left: `${immediatePct}%`,
              width: `${animatedCorrectedPct}%`,
            }}
            data-testid="lesson-summary-score-fill-corrected"
          />
        )}
        <span className="lesson-summary-score-label">
          <strong>{t("lesson.summary.score", "Score")}:</strong>{" "}
          <span data-testid="lesson-summary-score">
            {correct} / {total}
          </span>{" "}
          (<span data-testid="lesson-summary-score-pct">{animatedPct}</span>
          %)
        </span>
      </div>

      {hasCorrections && (
        <ul
          className="lesson-summary-score-legend"
          data-testid="lesson-summary-score-legend"
        >
          <li className="lesson-summary-score-legend-item">
            <span
              className="lesson-summary-score-swatch lesson-summary-score-swatch-immediate"
              aria-hidden="true"
            />
            <span>
              {t(
                "lesson.summary.score_legend_immediate",
                "{n} on the first try",
              ).replace("{n}", String(immediateCorrect))}
            </span>
          </li>
          <li className="lesson-summary-score-legend-item">
            <span
              className="lesson-summary-score-swatch lesson-summary-score-swatch-corrected"
              aria-hidden="true"
            />
            <span>
              {t(
                "lesson.summary.score_legend_corrected",
                "{n} after correcting",
              ).replace("{n}", String(correctedCount))}
            </span>
          </li>
        </ul>
      )}
    </>
  );
}

/**
 * The time / hints-used stat list (#1411 toggleable, the second half of
 * "Result and statistics").
 */
export function SummaryStatsList({
  enabled,
  minutes,
  hintsUsed,
  t,
}: {
  enabled: boolean;
  minutes: number;
  hintsUsed: number;
  t: TFn;
}) {
  if (!enabled) return null;
  return (
    <ul className="lesson-summary-stats">
      <li>
        <strong>{t("lesson.summary.time", "Time")}:</strong>{" "}
        <span data-testid="lesson-summary-time">
          {t("lesson.summary.minutes", "{n} min").replace(
            "{n}",
            String(minutes),
          )}
        </span>
      </li>
      {hintsUsed > 0 && (
        <li>
          <strong>{t("lesson.summary.hints_used", "Hints used")}:</strong>{" "}
          <span data-testid="lesson-summary-hints-used">
            {String(hintsUsed)}
          </span>
        </li>
      )}
    </ul>
  );
}

/**
 * The "Share result" row (#1073, #1411 toggleable). Renders ``null`` when
 * the section is disabled or the run is unscored.
 */
export function SummaryShare({
  enabled,
  total,
  result,
}: {
  enabled: boolean;
  total: number;
  result: ShareResultButtonProps["result"];
}) {
  if (!enabled || total <= 0) return null;
  return (
    <div
      className="lesson-summary-share flex justify-center"
      data-testid="lesson-summary-share"
    >
      <ShareResultButton result={result} />
    </div>
  );
}

/**
 * The exam-mode result panel (verdict + score + time + XP + retry). Renders
 * ``null`` when disabled (#1411), outside exam mode or on an unscored run.
 */
export function SummaryExamPanel({
  enabled,
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
  enabled: boolean;
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
  if (!enabled || lessonMode !== "exam" || total <= 0) return null;
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
  enabled,
  lessonMode,
  timedStats,
  t,
}: {
  enabled: boolean;
  lessonMode: LessonMode;
  timedStats: TimedRunStats | null;
  t: TFn;
}) {
  if (!enabled || lessonMode !== "timed" || !timedStats || timedStats.total <= 0)
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
  enabled,
  xpGain,
  animate,
  t,
}: {
  enabled: boolean;
  xpGain: number;
  animate: boolean;
  t: TFn;
}) {
  if (!enabled || xpGain <= 0) return null;
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
  // #2547 — ``mastered`` is an SRS-streak flag (3 consecutive correct
  // answers), not "the last attempt was wrong". A freshly correct answer
  // (even the very first, or a case-insensitive match) advances
  // correct_streak to >= 1 while mastered stays false until the streak
  // reaches 3 — filtering on !mastered showed already-correct answers
  // here with a diff implying a mistake that never happened. Every wrong
  // attempt resets correct_streak to 0 (applyScoreOutcome,
  // element-errors-dexie.ts), so correct_streak === 0 is exactly "the
  // last attempt on this element was wrong".
  const mistakes = sessionErrors
    .filter((e) => e.correct_streak === 0 && (e.user_answer ?? "").trim() !== "")
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
 * JSON, and an optional Anki-deck export. The copy / download / JSON handlers
 * are computed by the parent (which owns the breakdown); the card guard lives
 * here. (Social sharing moved to the dedicated ShareResultButton row, #1073.)
 */
export function SummaryExportActions({
  enabled,
  lesson,
  t,
  onCopy,
  onDownload,
  onDownloadJson,
}: {
  enabled: boolean;
  lesson: ContentLesson;
  t: TFn;
  onCopy: () => void;
  onDownload: () => void;
  onDownloadJson: () => void;
}) {
  if (!enabled) return null;
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
    </div>
  );
}
