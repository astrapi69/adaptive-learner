/**
 * Dashboard "Missionen" tab (#858).
 *
 * The motivation view: today's daily missions and the achievements/badges
 * gallery. Components are reorganized here unchanged; the badge data is fetched
 * once by the Dashboard and passed in.
 */

import DailyMissionsCard from "../../components/gamification/DailyMissionsCard";
import DashboardBadgeWidget from "../../components/badges/DashboardBadgeWidget";
import { useI18n } from "../../hooks/ui/useI18n";
import type { BadgeWithProgress } from "../../storage/types";

export interface DashboardMissionsTabProps {
  userId: string | null;
  badges: BadgeWithProgress[] | null;
}

export default function DashboardMissionsTab({
  userId,
  badges,
}: DashboardMissionsTabProps) {
  const { t } = useI18n();
  return (
    <section
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      data-testid="dashboard-tab-missions-panel"
    >
      {userId && (
        <article className="dashboard-card dashboard-card-wide">
          <DailyMissionsCard userId={userId} />
        </article>
      )}

      <article className="dashboard-card dashboard-card-wide">
        <h2 className="dashboard-card-title">{t("gamification.card_badges", "Badges")}</h2>
        <DashboardBadgeWidget badges={badges} />
      </article>
    </section>
  );
}
