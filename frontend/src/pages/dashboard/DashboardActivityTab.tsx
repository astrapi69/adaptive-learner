/**
 * Dashboard "Aktivität" tab (#858).
 *
 * The history + analytics view: review-due, the weekly activity trend + streak
 * heatmap, and the analytical panels (learning profile, sessions, progress,
 * method distribution, tool + spaced recommendations, recent sessions, and the
 * Learning Repository widget). Components are reorganized here unchanged; the
 * data is fetched once by the Dashboard and passed in.
 */

import { useNavigate } from "react-router";

import {DashboardCard, DashboardCardTitle} from "@/shared/layout";
import ActivityTrend from "../../components/dashboard/ActivityTrend";
import LearningRepoWidget from "../../components/dashboard/LearningRepoWidget";
import ReviewQueueCard from "../../components/dashboard/ReviewQueueCard";
import HelpLink from "../../components/help/HelpLink";
import HelpTooltip from "../../components/help/HelpTooltip";
import MethodDistribution from "../../components/progress/MethodDistribution";
import ProfileRadar from "../../components/progress/ProfileRadar";
import ProgressTimeline from "../../components/progress/ProgressTimeline";
import RecentSessions from "../../components/session/RecentSessions";
import SessionCounter from "../../components/session/SessionCounter";
import SpacedRecommendations from "../../components/session/SpacedRecommendations";
import StreakCalendar from "../../components/gamification/StreakCalendar";
import ToolRecommendations from "../../components/session/ToolRecommendations";
import { Button } from "@/components/ui/button";
import Tile from "../../shared/layout/Tile";
import { useI18n } from "../../hooks/ui/useI18n";
import type { HeatmapEntryOut } from "../../storage/types";
import type {
  LearningProfile,
  SpacedRecommendation,
  ToolRecommendation,
  TrackingSummary,
} from "../../types";

export interface DashboardActivityTabProps {
  userId: string | null;
  summary: TrackingSummary | null;
  tools: ToolRecommendation[];
  spaced: SpacedRecommendation[];
  heatmap: HeatmapEntryOut[] | null;
  profile: LearningProfile | null;
  incompleteAssessment: boolean;
  projectId: string | null;
}

export default function DashboardActivityTab({
  userId,
  summary,
  tools,
  spaced,
  heatmap,
  profile,
  incompleteAssessment,
  projectId,
}: DashboardActivityTabProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <section
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      data-testid="dashboard-tab-activity-panel"
    >
      {userId && <ReviewQueueCard userId={userId} />}

      <DashboardCard wide>
        <DashboardCardTitle>
          {t("gamification.card_streak", "Streak")}
        </DashboardCardTitle>
        <ActivityTrend entries={heatmap} />
        <StreakCalendar entries={heatmap} />
      </DashboardCard>

      <DashboardCard>
        <DashboardCardTitle>
          <HelpTooltip glossaryKey="learning_profile">
            {t("dashboard.card_profile", "Learning profile")}
          </HelpTooltip>
          <HelpLink glossaryKey="learning_profile" />
        </DashboardCardTitle>
        {profile ? (
          <ProfileRadar profile={profile} height={280} />
        ) : incompleteAssessment ? (
          <Tile
            className="flex flex-col items-start gap-2"
            data-testid="dashboard-profile-resume"
          >
            <p>{t("dashboard.profile_incomplete", "Learning profile incomplete.")}</p>
            <Button
              type="button"
              data-testid="dashboard-profile-resume-btn"
              onClick={() => navigate("/assessment")}
            >
              {t("dashboard.profile_resume", "Continue learning profile")}
            </Button>
          </Tile>
        ) : (
          <Tile
            className="flex flex-col items-start gap-2"
            data-testid="dashboard-profile-empty"
          >
            <p className="muted">{t("dashboard.no_data")}</p>
            <Button
              type="button"
              variant="outline"
              data-testid="dashboard-profile-start-btn"
              onClick={() => navigate("/assessment")}
            >
              {t("dashboard.profile_start", "Create learning profile")}
            </Button>
          </Tile>
        )}
      </DashboardCard>

      <DashboardCard>
        <DashboardCardTitle>
          <HelpTooltip glossaryKey="learning_session">
            {t("dashboard.card_counter", "Sessions")}
          </HelpTooltip>
          <HelpLink glossaryKey="learning_session" />
        </DashboardCardTitle>
        <SessionCounter summary={summary} />
      </DashboardCard>

      <DashboardCard wide>
        <DashboardCardTitle>{t("dashboard.card_progress", "Progress")}</DashboardCardTitle>
        <ProgressTimeline summary={summary} />
      </DashboardCard>

      <DashboardCard>
        <DashboardCardTitle>
          <HelpTooltip glossaryKey="method_ai_adaptive">
            {t("dashboard.card_distribution", "Method distribution")}
          </HelpTooltip>
          <HelpLink glossaryKey="method_ai_adaptive" />
        </DashboardCardTitle>
        <MethodDistribution summary={summary} />
      </DashboardCard>

      <DashboardCard>
        <DashboardCardTitle>
          {t("dashboard.card_tools", "Tool recommendations")}
        </DashboardCardTitle>
        <ToolRecommendations tools={tools} />
      </DashboardCard>

      <DashboardCard>
        <DashboardCardTitle>
          <HelpTooltip glossaryKey="feature_spaced_repetition">
            {t("dashboard.card_spaced", "Spaced practice")}
          </HelpTooltip>
          <HelpLink glossaryKey="feature_spaced_repetition" />
        </DashboardCardTitle>
        <SpacedRecommendations cards={spaced} />
      </DashboardCard>

      <DashboardCard wide>
        <DashboardCardTitle>
          {t("dashboard.card_recent_sessions", "Recent sessions")}
        </DashboardCardTitle>
        <RecentSessions sessions={summary?.recent_sessions ?? []} />
      </DashboardCard>

      {projectId ? <LearningRepoWidget projectId={projectId} /> : null}
    </section>
  );
}
