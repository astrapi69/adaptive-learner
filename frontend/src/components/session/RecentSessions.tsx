import {useNavigate} from "react-router";

import MethodBadge from "./MethodBadge";
import {useI18n} from "../../hooks/ui/useI18n";
import type {RecentSessionEntry} from "../../types";

interface RecentSessionsProps {
    sessions: readonly RecentSessionEntry[];
}

/**
 * Phase 7B: compact list of the most recent (up to) 5 sessions
 * for the Dashboard. Each row carries the method (color-coded
 * badge), date, understanding + stress as percentages, and
 * duration in minutes. Clicking the row navigates to the
 * Progress page where the full ProgressCommit table lives.
 *
 * Pure presentational: the parent owns the data fetch.
 */
export default function RecentSessions({sessions}: RecentSessionsProps) {
    const {t} = useI18n();
    const navigate = useNavigate();
    if (sessions.length === 0) {
        return (
            <p className="muted" data-testid="recent-sessions-empty">
                {t("dashboard.no_data")}
            </p>
        );
    }
    return (
        <ul className="recent-sessions" data-testid="recent-sessions">
            {sessions.map((row) => (
                <li
                    key={row.id}
                    className="recent-session-row"
                    data-testid={`recent-session-${row.id}`}
                    onClick={() => navigate("/progress")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate("/progress");
                        }
                    }}
                >
                    <div className="recent-session-line">
                        <MethodBadge method={row.method} compact />
                        <span className="recent-session-date">
                            {formatDate(row.committed_at)}
                        </span>
                    </div>
                    <div className="recent-session-stats">
                        <span>
                            {t("progress.commit_understanding", "Understanding")}:{" "}
                            <strong>{Math.round(row.understanding * 100)}%</strong>
                        </span>
                        <span>
                            {t("progress.commit_stress", "Stress")}:{" "}
                            <strong>{Math.round(row.stress * 100)}%</strong>
                        </span>
                        <span>
                            <strong>{row.duration_minutes}</strong>{" "}
                            {t("common.minutes", "minutes")}
                        </span>
                    </div>
                </li>
            ))}
        </ul>
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
