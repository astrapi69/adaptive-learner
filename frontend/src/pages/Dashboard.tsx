import {Map as MapIcon, Mic, Pencil} from "lucide-react";
import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";

import ApiKeyRequiredNotice from "../components/ApiKeyRequiredNotice";
import ContinueLearning from "../components/ContinueLearning";
import DashboardFilterBar from "../components/DashboardFilterBar";
import HelpLink from "../components/help/HelpLink";
import HelpTooltip from "../components/help/HelpTooltip";
import FocusAreasCard from "../components/dashboard/FocusAreasCard";
import PausedLessonsCard from "../components/dashboard/PausedLessonsCard";
import LearningRepoWidget from "../components/dashboard/LearningRepoWidget";
import ReviewQueueCard from "../components/dashboard/ReviewQueueCard";
import MethodDistribution from "../components/MethodDistribution";
import ProfileRadar from "../components/ProfileRadar";
import ProgressTimeline from "../components/ProgressTimeline";
import RecentSessions from "../components/RecentSessions";
import QuickStartButton from "../components/QuickStartButton";
import SessionCounter from "../components/SessionCounter";
import SpacedRecommendations from "../components/SpacedRecommendations";
import ToolRecommendations from "../components/ToolRecommendations";
import XPWidget from "../components/XPWidget";
import DashboardBadgeWidget from "../components/badges/DashboardBadgeWidget";
import DailyMissionsCard from "../components/DailyMissionsCard";
import StreakCalendar from "../components/StreakCalendar";
import StreakWidget from "../components/StreakWidget";
import {Button} from "@/components/ui/button";
import {ApiError} from "../api/client";
import {useApiKeyStatus} from "../hooks/useApiKeyStatus";
import {useI18n} from "../hooks/useI18n";
import {readLearnerState} from "../lib/learnerState";
import {getStorage} from "../storage";
import type {
    BadgeWithProgress,
    HeatmapEntryOut,
    StreakStateOut,
    XPState,
} from "../storage/types";
import type {
    LearningProfile,
    SpacedRecommendation,
    ToolRecommendation,
    TrackingSummary,
} from "../types";

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
    const {t, lang} = useI18n();
    const navigate = useNavigate();
    // Issue 4 — disable QuickStart when no API key is set.
    const apiKey = useApiKeyStatus();
    const [apiKeyBannerDismissed, setApiKeyBannerDismissed] =
        useState<boolean>(
            () =>
                localStorage.getItem(
                    "adaptive-learner.api_key_banner_dismissed",
                ) === "true",
        );
    const showApiKeyBanner =
        apiKey.ready && !apiKey.hasKey && !apiKeyBannerDismissed;
    function dismissApiKeyBanner() {
        try {
            localStorage.setItem(
                "adaptive-learner.api_key_banner_dismissed",
                "true",
            );
        } catch {
            /* localStorage unavailable — silent no-op */
        }
        setApiKeyBannerDismissed(true);
    }

    const [profile, setProfile] = useState<LearningProfile | null>(null);
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
            navigate("/onboarding", {replace: true});
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
            : Promise.resolve({eligible: false});
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
            const [
                profileR,
                summaryR,
                toolsR,
                spacedR,
                xpR,
                badgesR,
                streakR,
                heatmapR,
                eligR,
            ] = results;
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
            } else if (
                profileR.reason instanceof ApiError &&
                !profileR.reason.isNotFound
            ) {
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
    }, [lang, navigate, activeProjectVersion]);

    if (loading) {
        return (
            <main id="main" data-testid="dashboard-loading" className="dashboard-page">
                <p className="muted" role="status">{t("common.loading", "Loading…")}</p>
            </main>
        );
    }

    return (
        <main id="main" data-testid="dashboard" className="dashboard-page">
            <header className="dashboard-header">
                <h1>{t("dashboard.title", "Dashboard")}</h1>
                {error && <p className="error-text" role="alert">{error}</p>}
            </header>

            {/* UX overhaul C4 — Continue Learning at the TOP: answers
                "where was I, what next?" before any gamification. */}
            {userId && (
                <div className="mb-4">
                    <ContinueLearning userId={userId} maxItems={3} />
                </div>
            )}

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
                    <span style={{flex: 1, minWidth: 220}}>
                        {t(
                            "ui.api_key.skip_banner",
                            "Configure an API key in Settings to use AI features.",
                        )}
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
            {apiKey.ready && !apiKey.hasKey && (
                <ApiKeyRequiredNotice
                    compact
                    feature={t(
                        "ui.api_key.feature_session",
                        "to start a session",
                    )}
                />
            )}
            <QuickStartButton
                suggestedMethod={profile?.dominant_method ?? null}
                disabled={!apiKey.ready || !apiKey.hasKey}
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
                        title={t(
                            "dashboard.pronunciation_quick_start",
                            "Pronunciation Practice",
                        )}
                        aria-label={t(
                            "dashboard.pronunciation_quick_start",
                            "Pronunciation Practice",
                        )}
                        data-testid="dashboard-pronunciation-button"
                    >
                        <Mic className="h-5 w-5" aria-hidden="true" />
                        <span className="hidden md:inline">
                            {t(
                                "dashboard.pronunciation_quick_start",
                                "Pronunciation Practice",
                            )}
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
                    <span className="hidden md:inline">
                        {t("nav.learning_path", "Learning Path")}
                    </span>
                </Button>
            </div>

            {userId && (
                <DashboardFilterBar
                    userId={userId}
                    onSelectProject={() => setActiveProjectVersion((v) => v + 1)}
                />
            )}

            {/* UX overhaul C4 — widgets reordered around the learning
                flow: actionable first (paused, missions, focus, review),
                then motivational (XP / streak / badges), then the
                analytical panels. */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {userId && <PausedLessonsCard userId={userId} />}

                {userId && (
                    <article className="dashboard-card dashboard-card-wide">
                        <DailyMissionsCard userId={userId} />
                    </article>
                )}

                {userId && <FocusAreasCard userId={userId} />}
                {userId && <ReviewQueueCard userId={userId} />}

                <article className="dashboard-card">
                    <h2 className="dashboard-card-title">
                        <HelpTooltip glossaryKey="feature_gamification">
                            {t("gamification.card_xp", "XP & Level")}
                        </HelpTooltip>
                        <HelpLink glossaryKey="feature_gamification" />
                    </h2>
                    <XPWidget state={xpState} />
                </article>

                <article className="dashboard-card dashboard-card-wide">
                    <h2 className="dashboard-card-title">
                        {t("gamification.card_streak", "Streak")}
                    </h2>
                    <StreakWidget state={streakState} />
                    <StreakCalendar entries={heatmap} />
                </article>

                <article className="dashboard-card dashboard-card-wide">
                    <h2 className="dashboard-card-title">
                        {t("gamification.card_badges", "Badges")}
                    </h2>
                    <DashboardBadgeWidget badges={badges} />
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
                    ) : (
                        <div className="tile" data-testid="dashboard-profile-empty">
                            <p className="muted">{t("dashboard.no_data")}</p>
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
                    <h2 className="dashboard-card-title">
                        {t("dashboard.card_progress", "Progress")}
                    </h2>
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

                {/* Phase 49G: widget shows in BOTH storage modes.
                    DexieStorage.learningRepo renders client-side
                    (49E + parity-proven by 49F). */}
                {readLearnerState().projectId ? (
                    <LearningRepoWidget
                        projectId={readLearnerState().projectId as string}
                    />
                ) : null}
            </section>
        </main>
    );
}
