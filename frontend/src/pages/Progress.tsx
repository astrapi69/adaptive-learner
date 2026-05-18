import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";

import MethodBadge from "../components/MethodBadge";
import MethodDistribution from "../components/MethodDistribution";
import ProgressTimeline from "../components/ProgressTimeline";
import {api, ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {readLearnerState} from "../lib/learnerState";
import type {ProgressCommit, TrackingSummary} from "../types";

/**
 * Progress page (project-reference §8 row ``/progress``).
 *
 * Two roundtrips on mount:
 *
 *   - GET /api/plugins/tracking/progress/{project_id} -> summary
 *     (drives the timeline + method-distribution charts via the
 *     same components used by the Dashboard so visuals stay
 *     consistent).
 *   - GET /api/plugins/tracking/commits/{project_id}  -> full
 *     ProgressCommit history rendered as a table, newest first.
 */
export default function Progress() {
    const {t} = useI18n();
    const navigate = useNavigate();
    const [summary, setSummary] = useState<TrackingSummary | null>(null);
    const [commits, setCommits] = useState<ProgressCommit[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const projectId = readLearnerState().projectId;
        if (!projectId) {
            navigate("/onboarding", {replace: true});
            return;
        }
        let cancelled = false;
        Promise.all([
            api.tracking.progress(projectId),
            api.tracking.commits(projectId),
        ])
            .then(([progressResp, commitsResp]) => {
                if (cancelled) return;
                setSummary(progressResp.tracking ?? null);
                // Reverse so newest commits appear first; backend
                // returns ASC by committed_at.
                setCommits([...commitsResp].reverse());
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                const detail =
                    err instanceof ApiError ? err.detail : t("common.error");
                setLoadError(detail);
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    if (loading) {
        return (
            <main data-testid="progress-loading" className="dashboard-page">
                <p className="muted">{t("common.loading", "Loading…")}</p>
            </main>
        );
    }

    if (loadError) {
        return (
            <main data-testid="progress-error" className="dashboard-page">
                <p className="error-text">{loadError}</p>
            </main>
        );
    }

    return (
        <main data-testid="progress" className="dashboard-page">
            <header className="dashboard-header">
                <h1>{t("progress.title", "Progress")}</h1>
            </header>

            <section className="dashboard-grid">
                <article className="dashboard-card dashboard-card-wide">
                    <h2 className="dashboard-card-title">
                        {t("progress.chart_timeline", "Understanding and stress over time")}
                    </h2>
                    <ProgressTimeline summary={summary} height={280} />
                </article>

                <article className="dashboard-card dashboard-card-wide">
                    <h2 className="dashboard-card-title">
                        {t("progress.chart_methods", "Method distribution")}
                    </h2>
                    <MethodDistribution summary={summary} height={260} />
                </article>
            </section>

            <section className="dashboard-card dashboard-card-wide">
                <h2 className="dashboard-card-title">
                    {t("progress.commit_history", "Session history")}
                </h2>
                {commits.length === 0 ? (
                    <p className="muted" data-testid="progress-commits-empty">
                        {t("progress.no_commits", "No completed sessions yet.")}
                    </p>
                ) : (
                    <div className="commit-table-wrap">
                        <table className="commit-table" data-testid="progress-commits">
                            <thead>
                                <tr>
                                    <th>{t("progress.commit_date", "Date")}</th>
                                    <th>{t("progress.commit_method", "Method")}</th>
                                    <th>
                                        {t("progress.commit_understanding", "Understanding")}
                                    </th>
                                    <th>{t("progress.commit_stress", "Stress")}</th>
                                    <th>{t("progress.commit_duration", "Duration")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {commits.map((c) => (
                                    <tr key={c.id} data-testid={`commit-row-${c.id}`}>
                                        <td>{formatDate(c.committed_at)}</td>
                                        <td>
                                            <MethodBadge method={c.method} compact />
                                        </td>
                                        <td>{Math.round(c.understanding * 100)}%</td>
                                        <td>{Math.round(c.stress * 100)}%</td>
                                        <td>
                                            {c.duration_minutes}{" "}
                                            {t("common.minutes", "minutes")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}

function formatDate(iso: string): string {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleString();
    } catch {
        return iso;
    }
}
