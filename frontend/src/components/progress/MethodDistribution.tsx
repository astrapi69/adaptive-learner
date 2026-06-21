import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import {useChartTheme} from "../../hooks/ui/useChartTheme";
import {useI18n} from "../../hooks/ui/useI18n";
import {tooltipContentStyle} from "../../lib/chartTheme";
import {METHOD_COLORS, type LearningMethod} from "../../lib/constants";
import type {TrackingSummary} from "../../types";
import ChartSummary from "../charts/ChartSummary";

interface MethodDistributionProps {
    summary: TrackingSummary | null;
    height?: number;
}

interface BarDatum {
    method: LearningMethod;
    label: string;
    count: number;
    percentage: number;
    color: string;
}

/**
 * Phase 7B: bar chart showing sessions per method as both
 * absolute count AND percentage of total. Each bar is coloured
 * from METHOD_COLORS so the same hex flows across the radar
 * (Phase 4C) and this chart. v0.4.0 wires to the new
 * ``method_distribution`` field from the tracking aggregator
 * (one entry per method including zero-counts, percentages
 * pre-computed server-side so the chart stays a pure
 * presentation layer).
 *
 * The chart renders one bar per method even at zero count so
 * the user can see the full six-method comparison.
 */
export default function MethodDistribution({summary, height = 240}: MethodDistributionProps) {
    const {t} = useI18n();
    const chart = useChartTheme();
    if (!summary || summary.total_sessions === 0) {
        return (
            <div className="chart-tile" data-testid="method-distribution-empty">
                <p className="muted">{t("dashboard.no_data")}</p>
            </div>
        );
    }
    // method_distribution is server-sorted (count desc); preserve
    // that order in the chart so the most-used method is leftmost.
    const data: BarDatum[] = summary.method_distribution.map((entry) => ({
        method: entry.method,
        label: t(`methods.${entry.method}.label`, entry.method),
        count: entry.count,
        percentage: entry.percentage,
        color: METHOD_COLORS[entry.method],
    }));
    const top = data[0];
    const summaryText = t(
        "ui.a11y.chart_distribution_summary",
        "Most-used method: {method} ({count} sessions, {pct}%)",
    )
        .replace("{method}", top.label)
        .replace("{count}", String(top.count))
        .replace("{pct}", String(top.percentage));
    const chartLabel = t(
        "ui.a11y.chart_distribution_label",
        "Method distribution bar chart",
    );
    return (
        <div
            className="chart-tile"
            data-testid="method-distribution"
            role="img"
            aria-label={`${chartLabel}. ${summaryText}`}
            // ``minHeight`` is load-bearing — see ProgressTimeline
            // for the full explanation. Flex child of
            // ``.dashboard-card`` collapses to 0 during the first
            // layout pass without this; Recharts' ResizeObserver
            // then measures the parent as 0 and emits the
            // "width(-1) height(-1)" warning.
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
                // Suppress the Recharts-3.x first-render warning
                // before ResizeObserver measures the real parent.
                initialDimension={{width: 100, height: 100}}
            >
                <BarChart data={data} margin={{top: 12, right: 16, bottom: 12, left: 0}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                    <XAxis
                        dataKey="label"
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={56}
                        stroke={chart.axis}
                        tick={{fill: chart.axis}}
                    />
                    <YAxis allowDecimals={false} stroke={chart.axis} tick={{fill: chart.axis}} />
                    <Tooltip
                        contentStyle={tooltipContentStyle(chart)}
                        // Tooltip is informational only; the
                        // chart's primary metric (count) shows on
                        // the Y axis. The bar payload carries the
                        // pre-computed percentage so the tooltip
                        // can surface both. Loose typing here
                        // because Recharts' Formatter type has
                        // shifted across minor releases; the safe
                        // path is to cast inside the callback.
                        formatter={(value, _name, item) => {
                            const payload = (item as {payload?: BarDatum})
                                ?.payload;
                            const pct = payload?.percentage ?? 0;
                            return [
                                `${value} (${pct}%)`,
                                t("progress.commit_method", "Method"),
                            ];
                        }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {data.map((d) => (
                            <Cell key={d.method} fill={d.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <ChartSummary
                summary={summaryText}
                tableHeaders={[
                    t("progress.commit_method", "Method"),
                    t("progress.session_count", "Sessions"),
                    "%",
                ]}
                tableRows={data.map((d) => [d.label, d.count, d.percentage])}
                testid="method-distribution-summary"
            />
        </div>
    );
}
