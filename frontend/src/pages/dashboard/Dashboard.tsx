import { Map as MapIcon, Mic, Pencil } from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import ApiKeyRequiredNotice from "../../components/settings/ai/ApiKeyRequiredNotice";
import DashboardFilterBar from "../../components/DashboardFilterBar";
import QuickStartButton from "../../components/QuickStartButton";
import { Button } from "@/components/ui/button";
import { useFeature } from "@astrapi69/feature-strategy-react";
import { ApiError } from "../../api/client";
import { FEATURES } from "../../features/featureConfig";
import { useHasIncompleteAssessment } from "../../hooks/learning/useAssessmentProgress";
import { useI18n } from "../../hooks/ui/useI18n";
import { readLearnerState } from "../../lib/learnerState";
import { getStorage } from "../../storage";
import type { BadgeWithProgress, HeatmapEntryOut, StreakStateOut, XPState } from "../../storage/types";
import type {
  LearningProfile,
  SpacedRecommendation,
  ToolRecommendation,
  TrackingSummary,
} from "../../types";

// #858 — the Dashboard is split into three lazy-loaded tabs. The data is
// fetched once below and passed in, so only the active tab's bundle mounts.
const DashboardOverviewTab = lazy(() => import("./DashboardOverviewTab"));
const DashboardActivityTab = lazy(() => import("./DashboardActivityTab"));
const DashboardMissionsTab = lazy(() => import("./DashboardMissionsTab"));

type DashboardTabId = "overview" | "activity" | "missions";
const DASHBOARD_TAB_ORDER: DashboardTabId[] = ["overview", "activity", "missions"];
function normalizeDashboardTab(raw: string | null): DashboardTabId {
  return DASHBOARD_TAB_ORDER.includes(raw as DashboardTabId)
    ? (raw as DashboardTabId)
    : "overview";
}

/**
 * Dashboard page (project-reference §8 row ``/dashboard``).
 *
 * Three parallel API roundtrips on mount:
 *
 *   - GET /api/plugins/assessment/profile/{project_id}   -> radar
 *   - GET /api/plugins/tracking/progress/{project_id}    -> charts, counter
 *   - GET /api/plugins/tools/recommendations/{project_id} -> tool list
 *
 * Each panel renders an empty-state when its data is missing so
 * a fresh learner (no commits yet) sees a consistent layout.
 *
 * Pre-conditions: project_id present in localStorage; missing
 * redirects to /onboarding.
 */
export default function Dashboard() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const activeTab = normalizeDashboardTab(params.get("tab"));
  function selectTab(id: DashboardTabId) {
    const next = new URLSearchParams(params);
    if (id === "overview") next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  }
  // Issue 4 / feature-strategy — gate QuickStart on the SESSION_START
  // feature (disabled in Dexie mode without a key; active in API mode).
  const sessionFeature = useFeature(FEATURES.SESSION_START);
  const [apiKeyBannerDismissed, setApiKeyBannerDismissed] = useState<boolean>(
    () => localStorage.getItem("adaptive-learner.api_key_banner_dismissed") === "true",
  );
  const showApiKeyBanner = sessionFeature.isDisabled && !apiKeyBannerDismissed;
  function dismissApiKeyBanner() {
    try {
      localStorage.setItem("adaptive-learner.api_key_banner_dismissed", "true");
    } catch {
      /* localStorage unavailable — silent no-op */
    }
    setApiKeyBannerDismissed(true);
  }

  const [profile, setProfile] = useState<LearningProfile | null>(null);
  // #106 — when no profile yet, offer to resume an abandoned
  // assessment (active invitation), else to start one.
  const incompleteAssessment = useHasIncompleteAssessment(readLearnerState().projectId);
  const [summary, setSummary] = useState<TrackingSummary | null>(null);
  const [tools, setTools] = useState<ToolRecommendation[]>([]);
  const [spaced, setSpaced] = useState<SpacedRecommendation[]>([]);
  const [xpState, setXpState] = useState<XPState | null>(null);
  const [badges, setBadges] = useState<BadgeWithProgress[] | null>(null);
  const [streakState, setStreakState] = useState<StreakStateOut | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapEntryOut[] | null>(null);
  const [pronunciationEligible, setPronunciationEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * Bumped whenever the DashboardFilterBar swaps the active
   * projectId. Triggers the main fetch effect to re-run
   * against the new project's data.
   */
  const [activeProjectVersion, setActiveProjectVersion] = useState(0);

  const userId = readLearnerState().userId;

  useEffect(() => {
    const projectId = readLearnerState().projectId;
    if (!projectId) {
      navigate("/onboarding", { replace: true });
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const storage = getStorage();
    const xpPromise = userId
      ? storage.gamification.getState(userId)
      : Promise.resolve<XPState | null>(null);
    const badgesPromise = userId
      ? storage.gamification.listBadges(userId)
      : Promise.resolve<BadgeWithProgress[] | null>(null);
    const streakPromise = userId
      ? storage.gamification.getStreak(userId)
      : Promise.resolve<StreakStateOut | null>(null);
    const heatmapPromise = userId
      ? storage.gamification.getStreakHeatmap(userId, 365)
      : Promise.resolve<HeatmapEntryOut[] | null>(null);
    // v1.18.0 / Phase 31C — pronunciation quick-start is only
    // surfaced for projects with a Languages subject.
    const eligibilityPromise = projectId
      ? storage.pronunciation.eligibility(projectId).catch(() => ({
          eligible: false,
        }))
      : Promise.resolve({ eligible: false });
    Promise.allSettled([
      storage.assessment.profile(projectId),
      storage.tracking.progress(projectId),
      storage.tools.recommendations(projectId, lang),
      storage.tools.spaced(projectId, lang),
      xpPromise,
      badgesPromise,
      streakPromise,
      heatmapPromise,
      eligibilityPromise,
    ]).then((results) => {
      if (cancelled) return;
      const [profileR, summaryR, toolsR, spacedR, xpR, badgesR, streakR, heatmapR, eligR] = results;
      if (eligR.status === "fulfilled" && eligR.value) {
        setPronunciationEligible(eligR.value.eligible);
      }
      if (xpR.status === "fulfilled") {
        setXpState(xpR.value);
      }
      if (badgesR.status === "fulfilled") {
        setBadges(badgesR.value);
      }
      if (streakR.status === "fulfilled") {
        setStreakState(streakR.value);
      }
      if (heatmapR.status === "fulfilled") {
        setHeatmap(heatmapR.value);
      }

      if (profileR.status === "fulfilled") {
        setProfile(profileR.value);
      } else if (profileR.reason instanceof ApiError && !profileR.reason.isNotFound) {
        // 404 is benign — means the user never finished
        // the assessment. Anything else is a real error.
        setError(profileR.reason.detail);
      }

      if (summaryR.status === "fulfilled") {
        const tracking = summaryR.value.tracking ?? null;
        setSummary(tracking);
      }

      if (toolsR.status === "fulfilled") {
        setTools(toolsR.value);
      }

      if (spacedR.status === "fulfilled") {
        setSpaced(spacedR.value);
      }

      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [lang, navigate, activeProjectVersion, userId]);

  if (loading) {
    return (
      <main id="main" data-testid="dashboard-loading" className="dashboard-page">
        <p className="muted" role="status">
          {t("common.loading", "Loading…")}
        </p>
      </main>
    );
  }

  return (
    <main id="main" data-testid="dashboard" className="dashboard-page">
      <header className="dashboard-header">
        <h1>{t("dashboard.title", "Dashboard")}</h1>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </header>

      {showApiKeyBanner && (
        <div
          className="api-key-skip-banner"
          data-testid="api-key-skip-banner"
          role="status"
          style={{
            margin: "0 0 1rem 0",
            padding: "0.75rem 1rem",
            background: "var(--info-bg)",
            color: "var(--info)",
            border: "1px solid var(--info)",
            borderRadius: "var(--radius-md, 6px)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <span style={{ flex: 1, minWidth: 220 }}>
            {t("ui.api_key.skip_banner", "Configure an API key in Settings to use AI features.")}
          </span>
          <Button
            type="button"
            variant="default"
            onClick={() => navigate("/settings#api-keys")}
            data-testid="api-key-skip-banner-settings"
          >
            {t("ui.api_key.open_settings", "Open Settings")} →
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={dismissApiKeyBanner}
            data-testid="api-key-skip-banner-dismiss"
          >
            {t("ui.api_key.skip_banner_dismiss", "Dismiss")}
          </Button>
        </div>
      )}
      {sessionFeature.isDisabled && (
        <ApiKeyRequiredNotice
          compact
          feature={t("ui.api_key.feature_session", "to start a session")}
        />
      )}
      <QuickStartButton
        suggestedMethod={profile?.dominant_method ?? null}
        disabled={!sessionFeature.isActive}
      />

      {/* UX overhaul C5 — secondary action buttons: icon-only on
                mobile (min 44px touch target), icon + label from md up. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {pronunciationEligible && (
          <Button
            type="button"
            variant="secondary"
            className="dashboard-pronunciation-quick-start"
            onClick={() => navigate("/pronunciation")}
            title={t("dashboard.pronunciation_quick_start", "Pronunciation Practice")}
            aria-label={t("dashboard.pronunciation_quick_start", "Pronunciation Practice")}
            data-testid="dashboard-pronunciation-button"
          >
            <Mic className="h-5 w-5" aria-hidden="true" />
            <span className="hidden md:inline">
              {t("dashboard.pronunciation_quick_start", "Pronunciation Practice")}
            </span>
          </Button>
        )}

        <Button
          type="button"
          variant="secondary"
          className="dashboard-create-lesson"
          onClick={() => navigate("/create-lesson")}
          title={t("dashboard.create_lesson", "Create a lesson")}
          aria-label={t("dashboard.create_lesson", "Create a lesson")}
          data-testid="dashboard-create-lesson"
        >
          <Pencil className="h-5 w-5" aria-hidden="true" />
          <span className="hidden md:inline">
            {t("dashboard.create_lesson", "Create a lesson")}
          </span>
        </Button>

        <Button
          type="button"
          variant="secondary"
          className="dashboard-learning-path"
          onClick={() => navigate("/learning-path")}
          title={t("nav.learning_path", "Learning Path")}
          aria-label={t("nav.learning_path", "Learning Path")}
          data-testid="dashboard-learning-path"
        >
          <MapIcon className="h-5 w-5" aria-hidden="true" />
          <span className="hidden md:inline">{t("nav.learning_path", "Learning Path")}</span>
        </Button>
      </div>

      {userId && (
        <DashboardFilterBar
          userId={userId}
          onSelectProject={() => setActiveProjectVersion((v) => v + 1)}
        />
      )}

      {/* #858 — three tabs: Übersicht (default) / Aktivität / Missionen.
                The data fetched above is passed into the active (lazy) tab,
                so only the active tab's bundle mounts. */}
      <div
        role="tablist"
        aria-label={t("dashboard.title", "Dashboard")}
        data-testid="dashboard-tabs"
        className="mb-4 flex gap-1 border-b border-border"
      >
        {DASHBOARD_TAB_ORDER.map((id) => {
          const isActive = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectTab(id)}
              data-testid={`dashboard-tab-${id}`}
              className={`min-h-[44px] rounded-t-app px-4 text-sm font-medium ${
                isActive
                  ? "border-b-2 border-accent text-accent"
                  : "text-fg-muted hover:text-fg-primary"
              }`}
            >
              {t(`dashboard.tab.${id}`, id)}
            </button>
          );
        })}
      </div>

      <Suspense fallback={null}>
        {activeTab === "overview" && (
          <DashboardOverviewTab
            userId={userId}
            xpState={xpState}
            streakState={streakState}
          />
        )}
        {activeTab === "activity" && (
          <DashboardActivityTab
            userId={userId}
            summary={summary}
            tools={tools}
            spaced={spaced}
            heatmap={heatmap}
            profile={profile}
            incompleteAssessment={incompleteAssessment}
            projectId={readLearnerState().projectId}
          />
        )}
        {activeTab === "missions" && (
          <DashboardMissionsTab userId={userId} badges={badges} />
        )}
      </Suspense>
    </main>
  );
}
