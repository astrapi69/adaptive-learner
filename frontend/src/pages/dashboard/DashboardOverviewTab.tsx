/**
 * Dashboard "Übersicht" tab (#858).
 *
 * The at-a-glance "where was I / what now" view: Continue Learning plus the
 * quick stats (XP / Level, Streak) and the actionable cards (paused, focus,
 * favorites). Existing components are reorganized here unchanged — this is a
 * lazy-loaded wrapper, the data is fetched once by the Dashboard and passed in.
 */

import AiInviteCard from "../../components/dashboard/AiInviteCard";
import ContinueLearning from "../../components/dashboard/ContinueLearning";
import FavoritesCard from "../../components/dashboard/FavoritesCard";
import FocusAreasCard from "../../components/dashboard/FocusAreasCard";
import PausedLessonsCard from "../../components/dashboard/PausedLessonsCard";
import ReviewQueueCard from "../../components/dashboard/ReviewQueueCard";
import HelpLink from "../../components/help/HelpLink";
import HelpTooltip from "../../components/help/HelpTooltip";
import StreakWidget from "../../components/gamification/StreakWidget";
import XPWidget from "../../components/gamification/XPWidget";
import { useI18n } from "../../hooks/ui/useI18n";
import type { StreakStateOut, XPState } from "../../storage/types";

export interface DashboardOverviewTabProps {
  userId: string | null;
  xpState: XPState | null;
  streakState: StreakStateOut | null;
}

export default function DashboardOverviewTab({
  userId,
  xpState,
  streakState,
}: DashboardOverviewTabProps) {
  const { t } = useI18n();
  return (
    <div data-testid="dashboard-tab-overview-panel">
      {/* #931 — learner content first: Continue learning, then Review due,
          then quick stats, then the secondary actionable cards. */}
      {userId && (
        <div className="mb-4">
          <ContinueLearning userId={userId} maxItems={3} />
        </div>
      )}

      {/* #1417 — the optional BYOK invitation sits BELOW Weitermachen: for a
          fresh learner "start your first lesson" is the primary message, the
          AI invite is secondary. Self-gating (no key + not dismissed). */}
      <AiInviteCard />

      {userId && (
        <div className="mb-4">
          <ReviewQueueCard userId={userId} />
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="dashboard-card">
          <h2 className="dashboard-card-title">
            <HelpTooltip glossaryKey="feature_gamification">
              {t("gamification.card_xp", "XP & Level")}
            </HelpTooltip>
            <HelpLink glossaryKey="feature_gamification" />
          </h2>
          <XPWidget state={xpState} />
        </article>

        <article className="dashboard-card">
          <h2 className="dashboard-card-title">
            {t("gamification.card_streak", "Streak")}
          </h2>
          <StreakWidget state={streakState} />
        </article>

        {userId && (
          <>
            <PausedLessonsCard userId={userId} />
            <FocusAreasCard userId={userId} />
            <FavoritesCard userId={userId} />
          </>
        )}
      </section>
    </div>
  );
}
