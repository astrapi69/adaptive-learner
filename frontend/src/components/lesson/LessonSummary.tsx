/**
 * Lesson-completion summary card (extracted from Lesson.tsx, #404).
 *
 * After the last step: the star rating + count-up score bar + time, the
 * per-exercise breakdown (with token-diff on wrong text answers), result
 * export (Markdown / file / JSON), the SRS correction round, the smart
 * next-step suggestions, and the secondary next / repeat / exit actions.
 * Fires the lesson-complete celebration once on mount.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Download,
  FileJson,
  RotateCcw,
  Star,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import AnimatedCounter from "../../shared/AnimatedCounter";
import CorrectionBlock from "../exercises/CorrectionBlock";
import DiffHighlight from "../exercises/DiffHighlight";
import Confetti from "../feedback/Confetti";
import NextStepSuggestions from "./NextStepSuggestions";
import { useCountUp } from "../../hooks/useCountUp";
import { useFeedbackIntensity } from "../../hooks/useFeedbackIntensity";
import { useI18n } from "../../hooks/useI18n";
import LessonFavoriteToggle from "./LessonFavoriteToggle";
import { useNextStepSuggestions } from "../../hooks/useNextStepSuggestions";
import { collectFailedExercises } from "../../lib/lesson/error-replay";
import { tokenDiff } from "../../lib/exercises/token-diff";
import { allowsConfetti } from "../../lib/feedback/feedbackPref";
import {
  buildExerciseBreakdown,
  computeStars,
  type StarRating,
} from "../../lib/lesson-summary";
import type { LessonResultLabels } from "../../lib/lesson/result-export";
import {
  buildLessonJsonExport,
  buildLessonMarkdownExport,
  downloadBlob,
} from "../../lib/lesson/result-download";
import { isFirstAttempt } from "../../lib/gamification/first-attempt";
import { calculateLessonSessionXp } from "../../lib/gamification/lesson-xp";
import { emitCelebration } from "../../lib/praise/celebration-bus";
import { nextPraise } from "../../lib/praise/phrase-picker";
import { getStorage } from "../../storage";
import type { ContentLesson, ElementError, LessonProgress } from "../../storage/types";
import { notify } from "../../utils/notify";

interface LessonSummaryProps {
  lesson: ContentLesson;
  progress: LessonProgress | null;
  /** Next lesson's filename within the set, or null when
   *  there is no successor (last lesson OR list not yet
   *  fetched). When null, the "Next lesson" button hides. */
  nextLessonFilename: string | null;
  /** Phase 52F / v1.35.0 — user + set + lesson identifiers
   *  forwarded to the CorrectionBlock so it can load
   *  ElementError rows and persist new ElementAttempt rows
   *  against the same SRS keys. ``userId`` empty disables
   *  the block (anonymous lesson runs have no SRS history). */
  userId: string;
  setId: string;
  /** Resolved set source path (slug with ``--`` → ``/``). */
  source: string;
  /** Raw route slug (``--``-encoded), for the next-lesson href. */
  setSlug: string;
  lessonFilename: string;
  onMarkComplete: () => Promise<void> | void;
  onNextLesson: () => void;
  onRepeat: () => void;
  onExit: () => void;
}

/** Derive the display stats from the (possibly absent) progress row:
 *  the score, the rounded minutes (floored at 1), the completed flag and
 *  the score percentage. Missing values default to 0 so the summary
 *  still renders for an in-progress / unscored run. */
function deriveSummaryStats(progress: LessonProgress | null): {
  correct: number;
  total: number;
  minutes: number;
  isCompleted: boolean;
  scorePct: number;
} {
  const correct = progress?.score_correct ?? 0;
  const total = progress?.score_total ?? 0;
  const seconds = progress?.time_spent_seconds ?? 0;
  const minutes = Math.max(1, Math.round(seconds / 60));
  const isCompleted = progress?.status === "completed";
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, minutes, isCompleted, scorePct };
}

export default function LessonSummary({
  lesson,
  progress,
  nextLessonFilename,
  userId,
  setId,
  source,
  setSlug,
  lessonFilename,
  onMarkComplete,
  onNextLesson,
  onRepeat,
  onExit,
}: LessonSummaryProps) {
  const { t, lang } = useI18n();
  const intensity = useFeedbackIntensity();
  const { correct, total, minutes, isCompleted, scorePct } =
    deriveSummaryStats(progress);

  const stars: StarRating = computeStars(correct, total);
  const breakdown = useMemo(
    () => buildExerciseBreakdown(lesson, progress),
    [lesson, progress],
  );

  // Phase 64 — Smart Next-Step Suggestions. Load this lesson's
  // ElementError rows (lesson_id === filename) so the adaptive
  // suggestion can count + classify the run's mistakes, then
  // derive the full suggestion set. Reads are guarded so the
  // summary still renders if storage is unreachable; the
  // demoted action links below remain a working exit.
  const [sessionErrors, setSessionErrors] = useState<ElementError[]>([]);

  // #505 — the XP this run is worth. Computed with the same pure,
  // parity-tested gamification calculator the award path uses
  // (stars + first-attempt + streak multiplier), so the "+N XP"
  // shown here matches what was credited. The streak is the one
  // async input; it defaults to 0 (no multiplier) for an anonymous
  // run or an unreachable read, and refines once fetched.
  const [streakDays, setStreakDays] = useState(0);
  useEffect(() => {
    if (!userId) {
      setStreakDays(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const streak = await getStorage().gamification.getStreak(userId);
        if (!cancelled) setStreakDays(streak?.current_streak_days ?? 0);
      } catch {
        if (!cancelled) setStreakDays(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const xpGain = useMemo(() => {
    if (total <= 0) return 0;
    const firstAttempt = isFirstAttempt(
      JSON.stringify(progress?.step_results ?? null),
    );
    return calculateLessonSessionXp({
      stars,
      first_attempt: firstAttempt,
      streak_days: streakDays,
    }).xp_earned;
  }, [total, progress, stars, streakDays]);

  useEffect(() => {
    if (!userId) {
      setSessionErrors([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const errs = await getStorage().elementErrors.list(userId, {
          setId,
        });
        if (cancelled) return;
        setSessionErrors(errs.filter((e) => e.lesson_id === lessonFilename));
      } catch {
        if (!cancelled) setSessionErrors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, setId, lessonFilename]);

  // The exact exercises failed in THIS run — drives the
  // "Retry Errors" card + the ErrorReplay page (via router state).
  const failedExercises = useMemo(
    () => collectFailedExercises(lesson, progress),
    [lesson, progress],
  );

  const suggestions = useNextStepSuggestions({
    source,
    setId,
    lessonFilename,
    userId,
    stars,
    sessionErrors,
    failedExerciseCount: failedExercises.length,
  });

  // #138 — export the result (score + mistakes + weak areas) as
  // Markdown so the learner can paste it into an AI assistant to
  // drill the weak spots. Both actions reuse the breakdown already
  // computed for the on-screen list; no new storage read. The
  // builders live in lib/lesson/result-download (#354); only the
  // i18n label resolution stays here.
  const buildResultMarkdown = useCallback(() => {
    const labels: LessonResultLabels = {
      title: t("lesson.summary.export.title", "Lesson result"),
      date: t("lesson.summary.export.date", "Date"),
      score: t("lesson.summary.score", "Score"),
      correctWord: t("lesson.summary.export.correct", "correct"),
      mistakesHeading: t("lesson.summary.export.mistakes", "Mistakes"),
      noMistakes: t(
        "lesson.summary.export.no_mistakes",
        "No mistakes - perfect run!",
      ),
      question: t("lesson.summary.export.question", "Question"),
      yourAnswer: t("lesson.summary.export.your_answer", "Your answer"),
      noAnswer: t("lesson.summary.export.no_answer", "(none)"),
      correctAnswer: t("lesson.summary.export.correct_answer", "Correct"),
      weakAreasHeading: t("lesson.summary.export.weak_areas", "Weak areas"),
    };
    return buildLessonMarkdownExport({
      lesson,
      correct,
      total,
      pct: scorePct,
      sessionErrors,
      breakdown,
      labels,
    });
  }, [
    t,
    lesson,
    correct,
    total,
    scorePct,
    breakdown,
    sessionErrors,
  ]);

  const handleCopyResult = useCallback(async () => {
    const { markdown } = buildResultMarkdown();
    try {
      await navigator.clipboard.writeText(markdown);
      notify.success(
        t("lesson.summary.export.copied", "Result copied to clipboard"),
      );
    } catch {
      notify.error(
        t("lesson.summary.export.copy_failed", "Could not copy to clipboard"),
      );
    }
  }, [buildResultMarkdown, t]);

  const handleDownloadResult = useCallback(() => {
    const { markdown, filename } = buildResultMarkdown();
    downloadBlob(markdown, filename, "text/markdown");
  }, [buildResultMarkdown]);

  // #167 bug 3 — structured JSON twin of the Markdown export.
  const handleDownloadJson = useCallback(() => {
    const { json, filename } = buildLessonJsonExport({
      lesson,
      progress,
      correct,
      total,
      pct: scorePct,
      sessionErrors,
    });
    downloadBlob(json, filename, "application/json");
  }, [lesson, progress, correct, total, scorePct, sessionErrors]);

  // Count the score percentage up from 0 (instant under
  // "subtle" / reduced motion - see useCountUp).
  const animatedPct = useCountUp(scorePct, 1000, intensity !== "subtle");

  // Confetti only on a perfect (3-star) lesson, and only when
  // the intensity allows it. Self-dismisses after the burst.
  const celebrateConfetti = stars === 3 && allowsConfetti(intensity);
  const [showConfetti, setShowConfetti] = useState(celebrateConfetti);

  // The headline message: a "lesson_complete" praise phrase on a
  // perfect run (when phrases are allowed), otherwise the
  // per-star encouraging message. Picked once on mount.
  const ENCOURAGE_FALLBACK: Record<StarRating, string> = {
    0: "Practice makes perfect!",
    1: "Good start - keep going!",
    2: "Almost perfect!",
    3: "Perfect score!",
  };
  const [celebrateMessage] = useState<string>(() => {
    if (stars === 3 && intensity !== "subtle") {
      const picked = nextPraise("lesson_complete", lang);
      if (picked) return picked.phrase;
    }
    return t(`lesson.summary.encourage_${stars}`, ENCOURAGE_FALLBACK[stars]);
  });

  // Fire the lesson-complete celebration sounds once on mount.
  // The star chime + confetti sparkle only on a perfect run.
  const celebrationFired = useRef(false);
  useEffect(() => {
    if (celebrationFired.current) return;
    celebrationFired.current = true;
    emitCelebration({ type: "lesson_complete", payload: { stars } });
    if (stars === 3) {
      emitCelebration({ type: "stars_earned" });
      if (celebrateConfetti) emitCelebration({ type: "confetti" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      className={`lesson-summary${stars === 3 ? " is-celebrating" : ""}`}
      data-testid="lesson-summary"
      data-stars={String(stars)}
      aria-label={t("lesson.summary.aria_label", "Lesson summary")}
    >
      {celebrateConfetti && showConfetti && (
        <Confetti onDone={() => setShowConfetti(false)} />
      )}
      <h2>
        {isCompleted ? <CheckCircle2 size={20} aria-hidden="true" /> : null}
        {t("lesson.summary.heading", "You finished")}: {lesson.title}
      </h2>

      {userId && (
        <div
          className="flex items-center gap-1"
          data-testid="lesson-summary-favorite"
        >
          <LessonFavoriteToggle
            userId={userId}
            source={source}
            setId={setId}
            filename={lessonFilename}
            title={lesson.title}
            setTitle=""
            size={16}
          />
          <span className="text-sm text-fg-muted">
            {t("favorites.save_prompt", "Save this lesson to your favorites")}
          </span>
        </div>
      )}

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
        {celebrateMessage}
      </p>

      <div
        className="lesson-summary-score-bar"
        role="progressbar"
        aria-valuenow={scorePct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t(
          "lesson.summary.score_bar_aria",
          "Score: {pct} percent",
        ).replace("{pct}", String(scorePct))}
        data-testid="lesson-summary-score-bar"
      >
        <div
          className="lesson-summary-score-fill"
          style={{ width: `${animatedPct}%` }}
        />
        <span className="lesson-summary-score-label">
          <strong>{t("lesson.summary.score", "Score")}:</strong>{" "}
          <span data-testid="lesson-summary-score">
            {correct} / {total}
          </span>{" "}
          (<span data-testid="lesson-summary-score-pct">{animatedPct}</span>
          %)
        </span>
      </div>

      {xpGain > 0 && (
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
              enabled={intensity !== "subtle"}
              className="lesson-summary-xp-gain"
              testId="lesson-summary-xp-gain"
              format={(n) => `+${n} ${t("gamification.xp", "XP")}`}
            />
          </span>
        </div>
      )}

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
      </ul>

      {breakdown.length > 0 && (
        <section
          className="lesson-summary-breakdown"
          data-testid="lesson-summary-breakdown"
          aria-label={t(
            "lesson.summary.breakdown_heading",
            "Exercise breakdown",
          )}
        >
          <h3>{t("lesson.summary.breakdown_heading", "Exercise breakdown")}</h3>
          <ul className="lesson-summary-breakdown-list">
            {breakdown.map((entry) => {
              const rowStatus = !entry.attempted
                ? "unattempted"
                : entry.fullyCorrect
                  ? "correct"
                  : "wrong";
              return (
                <li
                  key={entry.stepId}
                  className={`lesson-summary-breakdown-row is-${rowStatus}`}
                  data-testid={`lesson-summary-breakdown-${entry.stepId}`}
                  data-status={rowStatus}
                >
                  <span className="lesson-summary-breakdown-title">
                    {entry.title}
                  </span>
                  {entry.attempted ? (
                    <span className="lesson-summary-breakdown-score">
                      {entry.correct} / {entry.total}
                    </span>
                  ) : (
                    <span className="lesson-summary-breakdown-score lesson-summary-breakdown-unattempted">
                      {t(
                        "lesson.summary.breakdown_unattempted",
                        "Not attempted",
                      )}
                    </span>
                  )}
                  {entry.attempted &&
                    !entry.fullyCorrect &&
                    entry.canonicalAnswer &&
                    // Phase 52C / v1.35.0 — when the
                    // stored user_answer is available
                    // (free-text + word-tiles), show
                    // the token-level diff against
                    // the canonical instead of a bare
                    // "Correct answer: X" line. The
                    // bare line stays as the fallback
                    // for matching + picture-choice
                    // (no text answer) and for
                    // lessons stored pre-v1.35.0.
                    (entry.userAnswer ? (
                      <span
                        className="lesson-summary-breakdown-diff"
                        data-testid={`lesson-summary-breakdown-diff-${entry.stepId}`}
                      >
                        <DiffHighlight
                          tokens={tokenDiff(
                            entry.userAnswer,
                            entry.canonicalAnswer,
                          )}
                        />
                      </span>
                    ) : (
                      <span className="lesson-summary-breakdown-canonical">
                        {t(
                          "lesson.summary.breakdown_correct_answer",
                          "Correct answer: {answer}",
                        ).replace("{answer}", entry.canonicalAnswer)}
                      </span>
                    ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* #138 — export the result for AI-assisted practice.
                Copy to clipboard or download as a .md file. Sits
                directly under the breakdown it summarizes. */}
      <div
        className="lesson-summary-export-actions flex flex-wrap gap-2"
        data-testid="lesson-summary-export"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 gap-2"
          onClick={() => {
            void handleCopyResult();
          }}
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
          onClick={handleDownloadResult}
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
          onClick={handleDownloadJson}
          data-testid="lesson-summary-download-json"
        >
          <FileJson aria-hidden="true" />
          {t("lesson.summary.export.download_json", "Export as JSON")}
        </Button>
      </div>

      {/* Phase 52F / v1.35.0 — correction round. Self-hides
                when the lesson was a perfect score, when no
                ElementError rows exist for it, OR when no cloze
                can be generated from the available errors. Users
                can skip; the Next-lesson button below stays
                visible throughout. */}
      {progress && userId && (
        <CorrectionBlock
          lesson={lesson}
          progress={progress}
          userId={userId}
          setId={setId}
          lessonFilename={lessonFilename}
          onComplete={() => {
            // Best-effort improvement counter is rendered
            // inside CorrectionBlock's "complete" surface;
            // nothing further needed at the parent level.
          }}
          onSkip={() => {
            // Skip is purely a UI dismissal — the action
            // row below was always visible.
          }}
        />
      )}

      {/* Completion is a distinct action from navigation, so
                it keeps its own prominent button above the smart
                suggestion cards. */}
      {!isCompleted && (
        <div className="lesson-summary-actions">
          <Button
            type="button"
            onClick={() => {
              void onMarkComplete();
            }}
            data-testid="lesson-summary-mark-complete"
          >
            {t("lesson.summary.mark_complete", "Mark as complete")}
          </Button>
        </div>
      )}

      {/* Phase 64 — Smart Next-Step Suggestions. The primary
                navigation surface; the standalone Next button below
                is only a graceful-degradation fallback. */}
      <NextStepSuggestions
        suggestions={suggestions}
        setId={setId}
        setSlug={setSlug}
        lessonFilename={lessonFilename}
        errorReplay={
          failedExercises.length > 0
            ? {
                exercises: failedExercises,
                cards: lesson.cards,
                lessonTitle: lesson.title,
              }
            : undefined
        }
      />

      <div className="lesson-summary-secondary-actions">
        {/* Fallback Next link — only when the smart card is
                    not surfacing a successor (hook still loading or a
                    storage read failed) but one exists. */}
        {/* #230 — outline, not ghost: ghost has no border/background so on
            the dark summary surface these read as faint text rather than
            buttons. Outline gives a visible border + keeps readable text. */}
        {!suggestions.nextLesson.available && nextLessonFilename && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNextLesson}
            data-testid="lesson-summary-next"
          >
            {t("lesson.summary.next_lesson", "Next lesson")}
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRepeat}
          data-testid="lesson-summary-repeat"
        >
          <RotateCcw aria-hidden="true" />
          {t("lesson.summary.repeat", "Repeat lesson")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExit}
          data-testid="lesson-summary-exit"
        >
          {t("lesson.summary.back_to_browser", "Back to content browser")}
        </Button>
      </div>
    </section>
  );
}
