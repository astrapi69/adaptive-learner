/**
 * Lesson-completion summary card (extracted from Lesson.tsx, #404).
 *
 * After the last step: the star rating + count-up score bar + time, the
 * per-exercise breakdown (with token-diff on wrong text answers), result
 * export (Markdown / file / JSON), the SRS correction round, the smart
 * next-step suggestions, and the secondary next / repeat / exit actions.
 * Fires the lesson-complete celebration once on mount.
 *
 * #1411 — every non-essential section is individually toggleable via the
 * Settings → Learning "Lesson summary" sub-area (``summarySectionsPref``,
 * all default ON). The heading, the mark-as-complete action and the
 * secondary next / repeat / exit actions are always rendered so the panel
 * never becomes a dead end.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, ChevronRight, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

import FormHint from "../../../shared/forms/FormHint";
import {CorrectionBlock} from "../../exercises";
import LessonAnswersDetail from "./LessonAnswersDetail";
import NextStepSuggestions from "./NextStepSuggestions";
import RetryResultComparison from "./RetryResultComparison";
import {
  SummaryConfetti,
  SummaryExamPanel,
  SummaryExplanations,
  SummaryExportActions,
  SummaryFavorite,
  SummaryScoreboard,
  SummaryShare,
  SummaryStatsList,
  SummaryTimedStats,
  SummaryXp,
} from "./LessonSummarySections";
import { useCountUp } from "../../../hooks/ui/useCountUp";
import { useFeedbackIntensity } from "../../../hooks/settings/useFeedbackIntensity";
import { useSummarySections } from "../../../hooks/settings/useSummarySections";
import {
  isSummarySectionEnabled,
  type SummarySectionKey,
} from "../../../lib/learning/summarySectionsPref";
import { useI18n } from "../../../hooks/ui/useI18n";
import { useNextStepSuggestions } from "../../../hooks/learning/useNextStepSuggestions";
import {
  collectFailedExercises,
  openFailedExercises,
} from "../../../lib/lesson/error-replay";
import { useLessonSessionErrors } from "../../../hooks/learning/useLessonSessionErrors";
import { allowsConfetti } from "../../../lib/feedback/feedbackPref";
import {
  buildExerciseBreakdown,
  computeStars,
  type StarRating,
} from "../../../lib/lesson/lesson-summary";
import type { LessonResultLabels } from "../../../lib/lesson/result-export";
import {
  buildLessonJsonExport,
  buildLessonMarkdownExport,
  downloadBlob,
} from "../../../lib/lesson/result-download";
import { isFirstAttempt } from "../../../lib/gamification/first-attempt";
import { calculateLessonSessionXp } from "../../../lib/gamification/lesson-xp";
import { configForMode } from "../../../lib/learning/lessonModeConfig";
import {
  examPassed,
  readExamPassThreshold,
  type LessonMode,
} from "../../../lib/learning/lessonModePref";
import type { TimedRunStats } from "../../../lib/learning/timedMode";
import { emitCelebration } from "../../../lib/praise/celebration-bus";
import { nextPraise } from "../../../lib/praise/phrase-picker";
import { getStorage } from "../../../storage";
import type {
  ContentLesson,
  LessonAttempt,
  LessonProgress,
} from "../../../storage/types";
import { notify } from "../../../utils/notify";

interface LessonSummaryProps {
  lesson: ContentLesson;
  progress: LessonProgress | null;
  /** #1007 — the mode the run was played in. In ``exam`` mode the summary
   *  adds a Passed / Not-passed line against the configured threshold.
   *  Defaults to ``practice`` so existing callers are unaffected. */
  lessonMode?: LessonMode;
  /** #1009 — timed-mode per-question timing summary (answered-in-time,
   *  average / fastest / slowest). Null outside timed mode. */
  timedStats?: TimedRunStats | null;
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
  /** Set title, stored on the favorite entry when saved from the summary
   *  (#1648 — carried through so removing the duplicate top-right star
   *  doesn't drop the favorite's set-name metadata). */
  setTitle: string;
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
  attempts: number;
  attemptHistory: LessonAttempt[];
  bestCorrect: number;
  bestTotal: number;
} {
  const correct = progress?.score_correct ?? 0;
  const total = progress?.score_total ?? 0;
  const seconds = progress?.time_spent_seconds ?? 0;
  const minutes = Math.max(1, Math.round(seconds / 60));
  const isCompleted = progress?.status === "completed";
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return {
    correct,
    total,
    minutes,
    isCompleted,
    scorePct,
    attempts: progress?.attempts ?? 0,
    attemptHistory: progress?.attempt_history ?? [],
    bestCorrect: progress?.best_score_correct ?? 0,
    bestTotal: progress?.best_score_total ?? 0,
  };
}

export default function LessonSummary({
  lesson,
  progress,
  lessonMode = "practice",
  timedStats = null,
  nextLessonFilename,
  userId,
  setId,
  setTitle,
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
  const {
    correct,
    total,
    minutes,
    isCompleted,
    scorePct,
    attempts,
    attemptHistory,
    bestCorrect,
    bestTotal,
  } = deriveSummaryStats(progress);

  const stars: StarRating = computeStars(correct, total);

  // #1007 — exam-mode pass/fail against the configured threshold.
  const examThreshold = useMemo(() => readExamPassThreshold(), []);
  const examPass =
    lessonMode === "exam" && examPassed(correct, total, examThreshold);

  // #594 Hint Economy — how many steps this run was answered with a hint
  // revealed. Read from the persisted step results.
  const hintsUsed = useMemo(
    () =>
      Object.values(progress?.step_results ?? {}).filter((r) => r.hint_used)
        .length,
    [progress],
  );
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
  const sessionErrors = useLessonSessionErrors(userId, setId, lessonFilename);

  // #505 — the XP this run is worth. Computed with the same pure,
  // parity-tested gamification calculator the award path uses
  // (stars + first-attempt + streak multiplier), so the "+N XP"
  // shown here matches what was credited. The streak is the one
  // async input; it defaults to 0 (no multiplier) for an anonymous
  // run or an unreachable read, and refines once fetched.
  const [streakDays, setStreakDays] = useState(0);
  // #1073 — the learner's level + total XP for the share card. Both default
  // to undefined (no level line on the card) for an anonymous / unreachable
  // run and refine once fetched, alongside the streak.
  const [level, setLevel] = useState<number | undefined>(undefined);
  const [totalXp, setTotalXp] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!userId) {
      setStreakDays(0);
      setLevel(undefined);
      setTotalXp(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      const storage = getStorage();
      try {
        const streak = await storage.gamification.getStreak(userId);
        if (!cancelled) setStreakDays(streak?.current_streak_days ?? 0);
      } catch {
        if (!cancelled) setStreakDays(0);
      }
      try {
        const state = await storage.gamification.getState(userId);
        if (!cancelled) {
          setLevel(state?.level);
          setTotalXp(state?.total_xp);
        }
      } catch {
        if (!cancelled) {
          setLevel(undefined);
          setTotalXp(undefined);
        }
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
      // #1007 Phase 2 — show the mode-weighted XP (exam = 1.5×) so the
      // summary matches the XP actually awarded.
      xp_multiplier: configForMode(lessonMode).xpMultiplier,
    }).xp_earned;
  }, [total, progress, stars, streakDays, lessonMode]);

  // #1007 Phase 2 — the mode reward weight as a percent bonus (exam = 50),
  // surfaced in the exam result card. 0 for practice (no bonus note).
  const modeBonusPct = Math.round(
    (configForMode(lessonMode).xpMultiplier - 1) * 100,
  );


  // #1426 (generalises #1411 / #1376) — which summary sections are shown AND
  // in which order, from the Settings → Learning "Lesson summary" sub-area.
  // Everything defaults ON in today's order; the essential completion
  // navigation below is never gated and stays pinned at the bottom.
  const sections = useSummarySections();
  const nextStepsEnabled = isSummarySectionEnabled(sections, "next_steps");

  // The exact exercises failed in THIS run — drives the
  // "Retry Errors" card + the ErrorReplay page (via router state).
  const failedExercises = useMemo(
    () => collectFailedExercises(lesson, progress),
    [lesson, progress],
  );

  // #1372 — of the exercises failed in this run, the ones STILL open in
  // the live SRS state (a correct error-replay attempt drops one out).
  // Drives the replay CTA + payload; the historical count (failedExercises)
  // is left intact for the statistics.
  const openFailed = useMemo(
    () => openFailedExercises(failedExercises, sessionErrors),
    [failedExercises, sessionErrors],
  );

  const suggestions = useNextStepSuggestions({
    source,
    setId,
    lessonFilename,
    userId,
    stars,
    sessionErrors,
    failedExerciseCount: openFailed.length,
    correctedExerciseCount: failedExercises.length - openFailed.length,
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

  // #1426 — each configurable section as a self-contained render node, keyed
  // by its stable id. The panel renders them in the user-configured order
  // (below); a node that maps to several sub-components (``result``) groups
  // them so the section moves as one unit. ``enabled`` is passed literally
  // true because the order loop only renders sections the config marks ON;
  // each node still self-gates on its own data (zero XP, wrong mode, ...).
  const sectionNodes: Record<SummarySectionKey, ReactNode> = {
    favorite: (
      <SummaryFavorite
        enabled
        userId={userId}
        source={source}
        setId={setId}
        setTitle={setTitle}
        filename={lessonFilename}
        title={lesson.title}
        t={t}
      />
    ),
    // "Result and statistics": stars + message + score bar, the exam / timed
    // result panels, the retry comparison and the time / hints stat list — all
    // one toggle (#1411), rendered as one contiguous block (#1426).
    result: (
      <>
        <SummaryScoreboard
          enabled
          stars={stars}
          message={celebrateMessage}
          animatedPct={animatedPct}
          scorePct={scorePct}
          correct={correct}
          total={total}
          t={t}
        />
        {/* #1007 Phase 2 — dedicated exam result panel (verdict + score +
            time + XP incl. bonus + retry). */}
        <SummaryExamPanel
          enabled
          lessonMode={lessonMode}
          total={total}
          examPass={examPass}
          examThreshold={examThreshold}
          correct={correct}
          scorePct={scorePct}
          minutes={minutes}
          xpGain={xpGain}
          bonusPct={modeBonusPct}
          onRetry={onRepeat}
        />
        {/* #1009 — timed-mode timing stats. */}
        <SummaryTimedStats
          enabled
          lessonMode={lessonMode}
          timedStats={timedStats}
          t={t}
        />
        {/* #983 — improvement vs the previous run + best score. */}
        <RetryResultComparison
          enabled
          attempts={attempts}
          attemptHistory={attemptHistory}
          bestCorrect={bestCorrect}
          bestTotal={bestTotal}
        />
        <SummaryStatsList
          enabled
          minutes={minutes}
          hintsUsed={hintsUsed}
          t={t}
        />
      </>
    ),
    xp: (
      <SummaryXp enabled xpGain={xpGain} animate={intensity !== "subtle"} t={t} />
    ),
    // #1073 — share the result (lesson title + score).
    share: (
      <SummaryShare
        enabled
        total={total}
        result={{
          lessonTitle: lesson.title,
          correct,
          total,
          scorePct,
          stars,
          level,
          xp: totalXp,
          streakDays,
        }}
      />
    ),
    // #1007 Phase 2 — the collected-answers "View all answers" detail.
    answers: <LessonAnswersDetail enabled breakdown={breakdown} />,
    // #138 — export the result for AI-assisted practice.
    export: (
      <SummaryExportActions
        enabled
        lesson={lesson}
        t={t}
        onCopy={() => {
          void handleCopyResult();
        }}
        onDownload={handleDownloadResult}
        onDownloadJson={handleDownloadJson}
      />
    ),
    // Phase 64 — Smart Next-Step Suggestions. The primary navigation surface;
    // the standalone Next fallback in the pinned continue-actions below covers
    // the case where this card is off or not surfacing a successor.
    next_steps: (
      <NextStepSuggestions
        enabled
        suggestions={suggestions}
        setId={setId}
        setSlug={setSlug}
        lessonFilename={lessonFilename}
        errorReplay={
          openFailed.length > 0
            ? {
                exercises: openFailed,
                cards: lesson.cards,
                lessonTitle: lesson.title,
              }
            : undefined
        }
      />
    ),
    // Phase 52F / v1.35.0 — correction round (#1376/#1411). Self-hides on a
    // perfect score, with no ElementError rows, or when no cloze can be
    // generated. The same errors stay reachable through "Fehler wiederholen"
    // / SRS review when the section is off or hidden.
    correction:
      progress && userId ? (
        <CorrectionBlock
          lesson={lesson}
          progress={progress}
          userId={userId}
          setId={setId}
          lessonFilename={lessonFilename}
          onComplete={() => {
            // Best-effort improvement counter is rendered inside
            // CorrectionBlock's "complete" surface; nothing further needed.
          }}
          onSkip={() => {
            // Skip is purely a UI dismissal — the pinned action row is always
            // visible below.
          }}
        />
      ) : null,
  };

  return (
    <section
      className={`lesson-summary${stars === 3 ? " is-celebrating" : ""}`}
      data-testid="lesson-summary"
      data-stars={String(stars)}
      aria-label={t("lesson.summary.aria_label", "Lesson summary")}
    >
      <SummaryConfetti active={celebrateConfetti} />
      <h2>
        {isCompleted ? <CheckCircle2 size={20} aria-hidden="true" /> : null}
        {t("lesson.summary.heading", "You finished")}: {lesson.title}
      </h2>

      {/* #1426 — the configurable sections, in the user-configured order.
          Only sections the config marks ON are rendered; each keeps its own
          data self-gate.

          #1432 — the #599 "why you missed these" mistake review renders
          immediately ABOVE the correction round (following it wherever the user
          reorders it), so the review and the drill that fixes those mistakes
          stay adjacent and ``correction`` is the last content section by
          default. It is not one of the reorderable sections (its own shared
          Settings toggle, ``review/reviewPref``), so it is spliced in here
          rather than added to the order block. */}
      {sections.map(({ id, enabled }) => {
        if (!enabled) return null;
        if (id === "correction") {
          return (
            <Fragment key={id}>
              <SummaryExplanations sessionErrors={sessionErrors} t={t} />
              {sectionNodes[id]}
            </Fragment>
          );
        }
        return <Fragment key={id}>{sectionNodes[id]}</Fragment>;
      })}

      {/* When the correction section is disabled it is not rendered above, so
          the mistake review (#599) falls back to just above the continue-actions
          — it is gated by its own toggle and must never be lost with correction
          off. */}
      {!isSummarySectionEnabled(sections, "correction") && (
        <SummaryExplanations sessionErrors={sessionErrors} t={t} />
      )}

      {/* Essential completion navigation — never toggleable, never in the
          reorder list, always pinned at the bottom so the panel can never
          become a dead end (#1426, "Weitermachen-Aktionen bleiben fix"). */}
      {!isCompleted && (
        <div className="lesson-summary-actions">
          {/* #1787 — an anonymous run (no learner profile) has nowhere to
              persist a completion (``useLesson.markCompleted`` no-ops
              without a user), so the button is disabled with a visible
              reason instead of dying silently (feature-state policy
              #335: visible-but-disabled, never a dead control). */}
          <Button
            type="button"
            disabled={!userId}
            title={
              !userId
                ? t(
                    "lesson.summary.mark_complete_needs_profile",
                    "Create a learner profile to save your progress",
                  )
                : undefined
            }
            onClick={() => {
              void onMarkComplete();
            }}
            data-testid="lesson-summary-mark-complete"
          >
            {t("lesson.summary.mark_complete", "Mark as complete")}
          </Button>
          {!userId && (
            <FormHint data-testid="lesson-summary-mark-complete-hint">
              {t(
                "lesson.summary.mark_complete_needs_profile",
                "Create a learner profile to save your progress",
              )}
            </FormHint>
          )}
        </div>
      )}

      <div className="lesson-summary-secondary-actions">
        {/* Fallback Next link — when the smart card is not surfacing a
            successor (hook still loading, a storage read failed, or the
            next-steps section is disabled, #1426) but one exists, so forward
            navigation never disappears. */}
        {/* #230 — outline, not ghost: ghost has no border/background so on
            the dark summary surface these read as faint text rather than
            buttons. Outline gives a visible border + keeps readable text. */}
        {(!nextStepsEnabled || !suggestions.nextLesson.available) &&
          nextLessonFilename && (
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
          {t("lesson.summary.retry", "Practice again")}
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
