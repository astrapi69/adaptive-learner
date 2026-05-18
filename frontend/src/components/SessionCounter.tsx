import {useI18n} from "../hooks/useI18n";
import type {TrackingSummary} from "../types";

interface SessionCounterProps {
    summary: TrackingSummary | null;
}

/**
 * Phase 7B: 5-cell metric tile.
 *
 * v0.4.0 widens the previous 3-cell tile (total / understanding /
 * stress) to surface the new tracking fields:
 *
 * - streak_days (consecutive calendar days with at least one
 *   session, strict 'missed today resets')
 * - total_minutes (sum of duration across every commit)
 * - total_sessions
 * - mean_understanding (% of 1.0)
 * - mean_stress (% of 1.0)
 *
 * Renders an empty-state message when ``summary`` is null OR
 * total_sessions is zero (no commits yet — the tracking
 * namespace is missing from the API response or the user hasn't
 * completed a session).
 */
export default function SessionCounter({summary}: SessionCounterProps) {
    const {t} = useI18n();
    if (!summary || summary.total_sessions === 0) {
        return (
            <div className="metric-tile" data-testid="session-counter-empty">
                <p className="muted">{t("dashboard.no_data")}</p>
            </div>
        );
    }
    const understanding = Math.round(summary.mean_understanding * 100);
    const stress = Math.round(summary.mean_stress * 100);
    return (
        <div className="metric-tile metric-grid-5" data-testid="session-counter">
            <div className="metric-cell">
                <span className="metric-label">
                    {t("dashboard.metric_streak", "Day streak")}
                </span>
                <span className="metric-value" data-testid="metric-streak">
                    {summary.streak_days}
                </span>
            </div>
            <div className="metric-cell">
                <span className="metric-label">
                    {t("dashboard.metric_total_sessions", "Total sessions")}
                </span>
                <span className="metric-value" data-testid="metric-total">
                    {summary.total_sessions}
                </span>
            </div>
            <div className="metric-cell">
                <span className="metric-label">
                    {t("dashboard.metric_total_minutes", "Total minutes")}
                </span>
                <span className="metric-value" data-testid="metric-minutes">
                    {summary.total_minutes}
                </span>
            </div>
            <div className="metric-cell">
                <span className="metric-label">
                    {t("dashboard.metric_mean_understanding", "Mean understanding")}
                </span>
                <span className="metric-value" data-testid="metric-understanding">
                    {understanding}%
                </span>
            </div>
            <div className="metric-cell">
                <span className="metric-label">
                    {t("dashboard.metric_mean_stress", "Mean stress")}
                </span>
                <span className="metric-value" data-testid="metric-stress">
                    {stress}%
                </span>
            </div>
        </div>
    );
}
