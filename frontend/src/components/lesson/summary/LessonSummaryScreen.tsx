/**
 * LessonSummaryScreen (#1790 — extracted from Lesson.tsx).
 *
 * The whole end-of-lesson screen: the summary card (score, correction
 * round, next-step actions) plus the "Vertiefe das Thema" resources,
 * with the three summary actions wired here — the mark-complete
 * celebration flow (snapshot -> markCompleted with the #1787/#1788
 * error toast -> badge/milestone celebration -> missions refresh),
 * the next-lesson navigation, and the #983 practice-again restart.
 * The page passes the lesson-session callbacks; navigation + i18n
 * come from the hooks here.
 */

import type { ComponentProps } from "react";
import { useNavigate } from "react-router";

import LessonSummary from "./LessonSummary";
import LessonResources from "../steps/LessonResources";
import { useI18n } from "../../../hooks/ui/useI18n";
import {
  captureCelebrationSnapshot,
  celebrateProgressSince,
} from "../../../lib/feedback/celebration-stats";
import { localTodayIso } from "../../../lib/missions/schedule";
import { celebrateMissions } from "../../../lib/praise/celebration-bus";
import { notify } from "../../../utils/notify";
import { getStorage } from "../../../storage";
import type { ContentLesson, ContentSetBook } from "../../../storage/types";

type SummaryPassThroughProps = Pick<
  ComponentProps<typeof LessonSummary>,
  | "lesson"
  | "progress"
  | "lessonMode"
  | "timedStats"
  | "nextLessonFilename"
  | "userId"
  | "setId"
  | "setTitle"
  | "source"
  | "setSlug"
  | "lessonFilename"
>;

export interface LessonSummaryScreenProps extends SummaryPassThroughProps {
  /** The ORIGINAL lesson (not the reverse-mode transform) for the
   *  resources section, which reads authored media references. */
  originalLesson: ContentLesson;
  setDomain: string | null;
  setBook: ContentSetBook | null;
  markCompleted: () => Promise<unknown>;
  markRestarted: () => Promise<unknown>;
  goToStep: (stepIndex: number) => void;
}

/**
 * Render the end-of-lesson summary + resources with the summary
 * actions wired.
 *
 * @example
 * <LessonSummaryScreen lesson={played} originalLesson={lesson}
 *     markCompleted={markCompleted} ... />
 */
export default function LessonSummaryScreen({
  originalLesson,
  setDomain,
  setBook,
  markCompleted,
  markRestarted,
  goToStep,
  ...summaryProps
}: LessonSummaryScreenProps) {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const { userId, setSlug, setId, nextLessonFilename } = summaryProps;

  const handleMarkComplete = async () => {
    // Snapshot gamification before completion so
    // any milestone / badge crossed by the award
    // can be detected + celebrated afterwards.
    const before = await captureCelebrationSnapshot(userId);
    try {
      await markCompleted();
    } catch (err) {
      // #1787 — a failed completion write was invisible on the
      // summary (the hook's error state only renders for load
      // failures). Surface it with the actual reason.
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t(
          "lesson.summary.mark_complete_failed",
          "Saving the completion failed",
        )}: ${detail}`,
      );
      return;
    }
    await celebrateProgressSince(
      userId,
      before,
      (badge) => ({
        name: t(badge.name_key, badge.key),
        description: t(badge.description_key, ""),
      }),
      (badge, newTier) => ({
        name: t(badge.name_key, badge.key),
        message: t(`gamification.tier.${newTier}`, newTier),
      }),
    );
    // Refresh daily missions so any whose progress
    // the just-completed lesson advanced flip to
    // complete (+ award their bonus XP). Best-effort.
    if (userId) {
      try {
        const r = await getStorage().missions.getDaily(userId, {
          todayIso: localTodayIso(lang),
        });
        const allComplete =
          r.missions.length > 0 && r.missions.every((m) => m.completed);
        celebrateMissions({
          newlyCompletedCount: r.newlyCompleted.length,
          allComplete,
          lang,
        });
      } catch {
        /* missions are supplementary */
      }
    }
  };

  return (
    <>
      <LessonSummary
        {...summaryProps}
        onMarkComplete={handleMarkComplete}
        onNextLesson={() => {
          if (nextLessonFilename) {
            navigate(`/lesson/${setSlug}/${setId}/${nextLessonFilename}`);
          }
        }}
        onRepeat={() => {
          // #983 — "Practice again": restart the row (clears step
          // results + score, status -> in_progress) so the next
          // completion is recorded as a fresh attempt and the
          // improvement vs the prior run can be shown. attempts /
          // best_score / attempt_history are preserved by the
          // storage layer. Then jump back to the first step.
          void markRestarted().then(() => goToStep(0));
        }}
        onExit={() => navigate("/content?tab=my")}
      />
      <LessonResources
        lesson={originalLesson}
        setDomain={setDomain}
        setBook={setBook}
      />
    </>
  );
}
