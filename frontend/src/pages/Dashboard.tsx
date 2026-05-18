import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";

import MethodDistribution from "../components/MethodDistribution";
import ProfileRadar from "../components/ProfileRadar";
import ProgressTimeline from "../components/ProgressTimeline";
import RecentSessions from "../components/RecentSessions";
import QuickStartButton from "../components/QuickStartButton";
import SessionCounter from "../components/SessionCounter";
import SpacedRecommendations from "../components/SpacedRecommendations";
import ToolRecommendations from "../components/ToolRecommendations";
import {api, ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {readLearnerState} from "../lib/learnerState";
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

    const [profile, setProfile] = useState<LearningProfile | null>(null);
    const [summary, setSummary] = useState<TrackingSummary | null>(null);
    const [tools, setTools] = useState<ToolRecommendation[]>([]);
    const [spaced, setSpaced] = useState<SpacedRecommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const projectId = readLearnerState().projectId;
        if (!projectId) {
            navigate("/onboarding", {replace: true});
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        Promise.allSettled([
            api.assessment.profile(projectId),
            api.tracking.progress(projectId),
            api.tools.recommendations(projectId, lang),
            api.tools.spaced(projectId, lang),
        ]).then((results) => {
            if (cancelled) return;
            const [profileR, summaryR, toolsR, spacedR] = results;

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
    }, [lang, navigate]);

    if (loading) {
        return (
            <main data-testid="dashboard-loading" className="dashboard-page">
                <p className="muted">{t("common.loading", "Loading…")}</p>
            </main>
        );
    }

    return (
        <main data-testid="dashboard" className="dashboard-page">
            <header className="dashboard-header">
                <h1>{t("dashboard.title", "Dashboard")}</h1>
                {error && <p className="error-text">{error}</p>}
            </header>

            <QuickStartButton
                suggestedMethod={profile?.dominant_method ?? null}
            />

            <section className="dashboard-grid">
                <article className="dashboard-card">
                    <h2 className="dashboard-card-title">
                        {t("dashboard.card_profile", "Learning profile")}
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
                        {t("dashboard.card_counter", "Sessions")}
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
                        {t("dashboard.card_distribution", "Method distribution")}
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
                        {t("dashboard.card_spaced", "Spaced practice")}
                    </h2>
                    <SpacedRecommendations cards={spaced} />
                </article>

                <article className="dashboard-card dashboard-card-wide">
                    <h2 className="dashboard-card-title">
                        {t("dashboard.card_recent_sessions", "Recent sessions")}
                    </h2>
                    <RecentSessions sessions={summary?.recent_sessions ?? []} />
                </article>
            </section>
        </main>
    );
}
