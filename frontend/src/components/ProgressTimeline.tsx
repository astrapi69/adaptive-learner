import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import {useI18n} from "../hooks/useI18n";
import type {TrackingSummary} from "../types";

interface ProgressTimelineProps {
    summary: TrackingSummary | null;
    height?: number;
}

interface TimelinePoint {
    index: number;
    understanding: number;
    stress: number;
}

/**
 * Two-series line chart of the most recent (up to)
 * ``TREND_WINDOW`` sessions' understanding and stress values,
 * oldest first.
 *
 * Empty-state ``summary`` (no commits yet) renders a muted
 * message instead of an empty chart. Single-point summaries
 * still render — Recharts handles a one-point Line cleanly.
 */
export default function ProgressTimeline({summary, height = 240}: ProgressTimelineProps) {
    const {t} = useI18n();
    if (!summary || summary.recent_understanding.length === 0) {
        return (
            <div className="chart-tile" data-testid="progress-timeline-empty">
                <p className="muted">{t("dashboard.no_data")}</p>
            </div>
        );
    }
    const u = summary.recent_understanding;
    const s = summary.recent_stress;
    const points: TimelinePoint[] = u.map((value, index) => ({
        index: index + 1,
        understanding: round2(value),
        stress: round2(s[index] ?? 0),
    }));
    return (
        <div
            className="chart-tile"
            data-testid="progress-timeline"
            style={{width: "100%", height}}
        >
            <ResponsiveContainer
                width="100%"
                height="100%"
                // See ProfileRadar for the rationale; suppress
                // the Recharts-3.x ``width(-1) height(-1)``
                // first-render warning.
                initialDimension={{width: 100, height: 100}}
            >
                <LineChart data={points} margin={{top: 12, right: 24, bottom: 12, left: 0}}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="index" />
                    <YAxis domain={[0, 1]} tickCount={6} />
                    <Tooltip />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="understanding"
                        name={t("progress.commit_understanding", "Understanding")}
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{r: 3}}
                    />
                    <Line
                        type="monotone"
                        dataKey="stress"
                        name={t("progress.commit_stress", "Stress")}
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={{r: 3}}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
