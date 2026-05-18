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

import {useI18n} from "../hooks/useI18n";
import {LEARNING_METHODS, METHOD_COLORS, type LearningMethod} from "../lib/constants";
import type {TrackingSummary} from "../types";

interface MethodDistributionProps {
    summary: TrackingSummary | null;
    height?: number;
}

interface BarDatum {
    method: LearningMethod;
    label: string;
    count: number;
    color: string;
}

/**
 * Horizontal-ish bar chart (one bar per method) showing the
 * number of completed sessions per method. The colour of each
 * bar comes from METHOD_COLORS so the same hex is used across
 * the radar (Phase 4C) and this chart.
 *
 * Methods without sessions are still rendered with a zero
 * value so the user can see the full six-method comparison.
 */
export default function MethodDistribution({summary, height = 240}: MethodDistributionProps) {
    const {t} = useI18n();
    if (!summary || summary.total_sessions === 0) {
        return (
            <div className="chart-tile" data-testid="method-distribution-empty">
                <p className="muted">{t("dashboard.no_data")}</p>
            </div>
        );
    }
    const data: BarDatum[] = LEARNING_METHODS.map((method) => ({
        method,
        label: t(`methods.${method}.label`, method),
        count: summary.sessions_per_method[method] ?? 0,
        color: METHOD_COLORS[method],
    }));
    return (
        <div
            className="chart-tile"
            data-testid="method-distribution"
            style={{width: "100%", height}}
        >
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{top: 12, right: 16, bottom: 12, left: 0}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" interval={0} angle={-20} textAnchor="end" height={56} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {data.map((d) => (
                            <Cell key={d.method} fill={d.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
