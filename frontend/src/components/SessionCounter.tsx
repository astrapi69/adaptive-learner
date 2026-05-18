import {useI18n} from "../hooks/useI18n";
import type {TrackingSummary} from "../types";

interface SessionCounterProps {
    summary: TrackingSummary | null;
}

/**
 * Compact text tile with the headline counters: total sessions
 * + mean understanding + mean stress. Renders an empty-state
 * message when ``summary`` is null (no commits yet — the
 * tracking namespace is missing from the API response).
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
    const total = summary.total_sessions;
    const understanding = Math.round(summary.mean_understanding * 100);
    const stress = Math.round(summary.mean_stress * 100);
    return (
        <div className="metric-tile metric-grid" data-testid="session-counter">
            <div className="metric-cell">
                <span className="metric-label">
                    {t("dashboard.metric_total_sessions", "Total sessions")}
                </span>
                <span className="metric-value" data-testid="metric-total">
                    {total}
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
