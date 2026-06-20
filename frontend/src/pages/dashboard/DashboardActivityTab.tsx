/**
 * Dashboard "Aktivität" tab (#858).
 *
 * The history + analytics view: review-due, the weekly activity trend + streak
 * heatmap, and the analytical panels (learning profile, sessions, progress,
 * method distribution, tool + spaced recommendations, recent sessions, and the
 * Learning Repository widget). Components are reorganized here unchanged; the
 * data is fetched once by the Dashboard and passed in.
 */

import { useNavigate } from "react-router-dom";

import ActivityTrend from "../../components/dashboard/ActivityTrend";
import LearningRepoWidget from "../../components/dashboard/LearningRepoWidget";
import ReviewQueueCard from "../../components/dashboard/ReviewQueueCard";
import HelpLink from "../../components/help/HelpLink";
import HelpTooltip from "../../components/help/HelpTooltip";
import MethodDistribution from "../../components/MethodDistribution";
import ProfileRadar from "../../components/ProfileRadar";
import ProgressTimeline from "../../components/ProgressTimeline";
import RecentSessions from "../../components/RecentSessions";
import SessionCounter from "../../components/SessionCounter";
import SpacedRecommendations from "../../components/SpacedRecommendations";
import StreakCalendar from "../../components/StreakCalendar";
import ToolRecommendations from "../../components/ToolRecommendations";
import { Button } from "@/components/ui/button";
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

      <article className="dashboard-card dashboard-card-wide">
        <h2 className="dashboard-card-title">
          {t("gamification.card_streak", "Streak")}
        </h2>
        <ActivityTrend entries={heatmap} />
        <StreakCalendar entries={heatmap} />
      </article>

      <article className="dashboard-card">
        <h2 className="dashboard-card-title">
          <HelpTooltip glossaryKey="learning_profile">
            {t("dashboard.card_profile", "Learning profile")}
          </HelpTooltip>
          <HelpLink glossaryKey="learning_profile" />
        </h2>
        {profile ? (
          <ProfileRadar profile={profile} height={280} />
        ) : incompleteAssessment ? (
          <div
            className="tile flex flex-col items-start gap-2"
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
          </div>
        ) : (
          <div
            className="tile flex flex-col items-start gap-2"
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
          </div>
        )}
      </article>

      <article className="dashboard-card">
        <h2 className="dashboard-card-title">
          <HelpTooltip glossaryKey="learning_session">
            {t("dashboard.card_counter", "Sessions")}
          </HelpTooltip>
          <HelpLink glossaryKey="learning_session" />
        </h2>
        <SessionCounter summary={summary} />
      </article>

      <article className="dashboard-card dashboard-card-wide">
        <h2 className="dashboard-card-title">{t("dashboard.card_progress", "Progress")}</h2>
        <ProgressTimeline summary={summary} />
      </article>

      <article className="dashboard-card">
        <h2 className="dashboard-card-title">
          <HelpTooltip glossaryKey="method_ai_adaptive">
            {t("dashboard.card_distribution", "Method distribution")}
          </HelpTooltip>
          <HelpLink glossaryKey="method_ai_adaptive" />
        </h2>
        <MethodDistribution summary={summary} />
      </article>

      <article className="dashboard-card">
        <h2 className="dashboard-card-title">
          {t("dashboard.card_tools", "Tool recommendations")}
        </h2>
        <ToolRecommendations tools={tools} />
      </article>

      <article className="dashboard-card">
        <h2 className="dashboard-card-title">
          <HelpTooltip glossaryKey="feature_spaced_repetition">
            {t("dashboard.card_spaced", "Spaced practice")}
          </HelpTooltip>
          <HelpLink glossaryKey="feature_spaced_repetition" />
        </h2>
        <SpacedRecommendations cards={spaced} />
      </article>

      <article className="dashboard-card dashboard-card-wide">
        <h2 className="dashboard-card-title">
          {t("dashboard.card_recent_sessions", "Recent sessions")}
        </h2>
        <RecentSessions sessions={summary?.recent_sessions ?? []} />
      </article>

      {projectId ? <LearningRepoWidget projectId={projectId} /> : null}
    </section>
  );
}
