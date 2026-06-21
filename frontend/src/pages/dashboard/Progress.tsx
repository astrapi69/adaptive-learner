import {Fragment, useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";

import MethodBadge from "../../components/session/MethodBadge";
import NotebookLMSection from "../../components/settings/integrations/NotebookLMSection";
import MethodDistribution from "../../components/MethodDistribution";
import ProgressTimeline from "../../components/ProgressTimeline";
import StepEvaluationInsights from "../../components/session/StepEvaluationInsights";
import RichTextEditor from "../../components/editor/RichTextEditor";
import {parseEditorContent} from "../../components/editor/content-utils";
import {ApiError} from "../../api/client";
import {useI18n} from "../../hooks/ui/useI18n";
import {readLearnerState} from "../../lib/learnerState";
import {getStorage} from "../../storage";
import type {
    ProgressCommit,
    StepEvaluationSummary,
    TrackingSummary,
} from "../../types";

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
    const [stepEvalSummary, setStepEvalSummary] =
        useState<StepEvaluationSummary | null>(null);
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
            getStorage().tracking.progress(projectId),
            getStorage().tracking.commits(projectId),
        ])
            .then(([progressResp, commitsResp]) => {
                if (cancelled) return;
                setSummary(progressResp.tracking ?? null);
                // v0.5.0 / 8D — Phase 8 step-evaluation aggregates
                // come on the same response under their own
                // namespace. Missing namespace (e.g. older backend)
                // → null → component renders empty-state.
                setStepEvalSummary(progressResp.step_evaluation ?? null);
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
            <main id="main" data-testid="progress-loading" className="dashboard-page">
                <p className="muted" role="status">{t("common.loading", "Loading…")}</p>
            </main>
        );
    }

    if (loadError) {
        return (
            <main id="main" data-testid="progress-error" className="dashboard-page">
                <p className="error-text" role="alert">{loadError}</p>
            </main>
        );
    }

    return (
        <main id="main" data-testid="progress" className="dashboard-page">
            <header className="dashboard-header">
                <h1>{t("progress.title", "Progress")}</h1>
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    {t(
                        "progress.step_eval_title",
                        "AI step-evaluation insights",
                    )}
                </h2>
                <StepEvaluationInsights summary={stepEvalSummary} />
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
                                    <th scope="col">{t("progress.commit_date", "Date")}</th>
                                    <th scope="col">{t("progress.commit_method", "Method")}</th>
                                    <th scope="col">
                                        {t("progress.commit_understanding", "Understanding")}
                                    </th>
                                    <th scope="col">{t("progress.commit_stress", "Stress")}</th>
                                    <th scope="col">{t("progress.commit_duration", "Duration")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {commits.map((c) => {
                                    const notesDoc = parseEditorContent(c.notes);
                                    return (
                                        <Fragment key={c.id}>
                                            <tr data-testid={`commit-row-${c.id}`}>
                                                <td>
                                                    {formatDate(c.committed_at)}
                                                </td>
                                                <td>
                                                    <MethodBadge
                                                        method={c.method}
                                                        compact
                                                    />
                                                </td>
                                                <td>
                                                    {Math.round(
                                                        c.understanding * 100,
                                                    )}
                                                    %
                                                </td>
                                                <td>
                                                    {Math.round(c.stress * 100)}%
                                                </td>
                                                <td>
                                                    {c.duration_minutes}{" "}
                                                    {t(
                                                        "common.minutes",
                                                        "minutes",
                                                    )}
                                                </td>
                                            </tr>
                                            {notesDoc ? (
                                                <tr
                                                    data-testid={`commit-notes-row-${c.id}`}
                                                    className="commit-notes-row"
                                                >
                                                    <td colSpan={5}>
                                                        <RichTextEditor
                                                            content={notesDoc}
                                                            editable={false}
                                                            testidNamespace={`commit-notes-${c.id}`}
                                                            ariaLabel={t(
                                                                "progress.commit_notes_aria",
                                                                "Session notes",
                                                            )}
                                                        />
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* v1.19.0 / Phase 32 — NotebookLM-ready study
                materials surface. Only renders when a project is
                active (which it is for any user who reached this
                page, per the redirect guard in the mount
                effect). */}
            {(() => {
                const pid = readLearnerState().projectId;
                return pid ? <NotebookLMSection projectId={pid} /> : null;
            })()}
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
