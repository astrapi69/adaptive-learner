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

import {useChartTheme} from "../hooks/useChartTheme";
import {useI18n} from "../hooks/useI18n";
import {tooltipContentStyle} from "../lib/chartTheme";
import type {TrackingSummary} from "../types";
import ChartSummary from "./charts/ChartSummary";

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
    const chart = useChartTheme();
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
    const trendKey = computeTrendKey(u);
    const trendLabel = t(`ui.a11y.chart_timeline_trend_${trendKey}`, trendKey);
    const summaryText = t(
        "ui.a11y.chart_timeline_summary",
        "{n} sessions; understanding trending {trend}",
    )
        .replace("{n}", String(points.length))
        .replace("{trend}", trendLabel);
    const chartLabel = t(
        "ui.a11y.chart_timeline_label",
        "Progress timeline of the last {n} sessions",
    ).replace("{n}", String(points.length));
    return (
        <div
            className="chart-tile"
            data-testid="progress-timeline"
            role="img"
            aria-label={`${chartLabel}. ${summaryText}`}
            // ``minHeight`` is load-bearing: ``.dashboard-card``
            // is ``display: flex; flex-direction: column``, so a
            // flex child without an explicit min-height collapses
            // to 0 during the first layout pass — Recharts' own
            // ResizeObserver then measures the parent as 0 and
            // emits the "width(-1) height(-1)" console warning.
            // ``minWidth: 0`` mirrors the same trick for the
            // horizontal axis when the card sits in a tight grid.
            style={{
                width: "100%",
                minWidth: 0,
                height,
                minHeight: height,
            }}
        >
            <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                // See ProfileRadar for the rationale; the
                // ``initialDimension`` suppresses the warning on
                // the first render before ResizeObserver fires.
                initialDimension={{width: 100, height: 100}}
            >
                <LineChart data={points} margin={{top: 12, right: 24, bottom: 12, left: 0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                    <XAxis dataKey="index" stroke={chart.axis} tick={{fill: chart.axis}} />
                    <YAxis
                        domain={[0, 1]}
                        tickCount={6}
                        stroke={chart.axis}
                        tick={{fill: chart.axis}}
                    />
                    <Tooltip contentStyle={tooltipContentStyle(chart)} />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="understanding"
                        name={t("progress.commit_understanding", "Understanding")}
                        stroke={chart.success}
                        strokeWidth={2}
                        dot={{r: 3}}
                    />
                    <Line
                        type="monotone"
                        dataKey="stress"
                        name={t("progress.commit_stress", "Stress")}
                        stroke={chart.error}
                        strokeWidth={2}
                        dot={{r: 3}}
                    />
                </LineChart>
            </ResponsiveContainer>
            <ChartSummary
                summary={summaryText}
                tableHeaders={[
                    "#",
                    t("progress.commit_understanding", "Understanding"),
                    t("progress.commit_stress", "Stress"),
                ]}
                tableRows={points.map((p) => [
                    p.index,
                    p.understanding,
                    p.stress,
                ])}
                testid="progress-timeline-summary"
            />
        </div>
    );
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * Classify the trend of the understanding series as
 * up / down / flat. Threshold of 0.05 absolute change to
 * suppress noise from a single jittery sample.
 */
function computeTrendKey(values: readonly number[]): "up" | "down" | "flat" {
    if (values.length < 2) return "flat";
    const first = values[0];
    const last = values[values.length - 1];
    const delta = last - first;
    if (delta > 0.05) return "up";
    if (delta < -0.05) return "down";
    return "flat";
}
