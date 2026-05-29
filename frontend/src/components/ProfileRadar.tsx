import {
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
} from "recharts";

import {useChartTheme} from "../hooks/useChartTheme";
import {useI18n} from "../hooks/useI18n";
import {LEARNING_METHODS, METHOD_COLORS} from "../lib/constants";
import type {LearningProfile} from "../types";
import ChartSummary from "./charts/ChartSummary";

interface ProfileRadarProps {
    profile: LearningProfile;
    /**
     * Pixel height for the wrapping container. ResponsiveContainer
     * pulls width from the parent flex/grid cell automatically;
     * the height stays a fixed pixel value so the layout doesn't
     * collapse to 0 when the chart mounts before its data.
     */
    height?: number;
}

/**
 * 6-axis radar chart driven by a LearningProfile. Axis labels
 * come from the i18n catalog (``methods.{key}.label``); the
 * stroke / fill colour is the brand accent. A separate colour
 * per axis would be visually noisy on a single-series chart;
 * the bar chart in Phase 4D's MethodDistribution uses the per-
 * method palette.
 */
export default function ProfileRadar({profile, height = 320}: ProfileRadarProps) {
    const {t} = useI18n();
    const chart = useChartTheme();
    const data = LEARNING_METHODS.map((method) => ({
        method,
        label: t(`methods.${method}.label`, method),
        value: profile[method],
    }));
    const dominantLabel = t(
        `methods.${profile.dominant_method}.label`,
        profile.dominant_method,
    );
    const dominantValue = profile[profile.dominant_method];
    const summary = t(
        "ui.a11y.chart_radar_summary",
        "Your strongest learning method: {method} ({value})",
    )
        .replace("{method}", dominantLabel)
        .replace("{value}", String(round2(dominantValue)));
    const chartLabel = t(
        "ui.a11y.chart_radar_label",
        "Learning profile radar chart",
    );
    return (
        <div
            className="profile-radar"
            data-testid="profile-radar"
            role="img"
            aria-label={`${chartLabel}. ${summary}`}
            // ``minHeight`` + ``minWidth: 0`` are load-bearing —
            // see ProgressTimeline for the full explanation. The
            // chart sits inside ``.dashboard-card`` which is
            // ``display: flex; flex-direction: column``, so a
            // child without explicit ``min-height`` collapses to
            // 0 during the first layout pass.
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
                // Recharts 3.x defaults ``initialDimension`` to
                // ``{width:-1, height:-1}`` and the first render
                // emits a "width(-1) and height(-1) ... should be
                // greater than 0" console warning before the
                // internal ResizeObserver measures the real parent
                // and re-renders. Passing a positive sentinel
                // suppresses the noise; the real dimensions take
                // over on the next frame.
                initialDimension={{width: 100, height: 100}}
            >
                <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                    data={data}
                >
                    <PolarGrid stroke={chart.grid} />
                    <PolarAngleAxis dataKey="label" tick={{fill: chart.axis}} />
                    <PolarRadiusAxis
                        angle={90}
                        domain={[0, 1]}
                        tickCount={5}
                        stroke={chart.axis}
                        tick={{fill: chart.axis}}
                    />
                    <Radar
                        name="profile"
                        dataKey="value"
                        stroke={METHOD_COLORS[profile.dominant_method] ?? chart.accent}
                        fill={METHOD_COLORS[profile.dominant_method] ?? chart.accent}
                        fillOpacity={0.32}
                    />
                </RadarChart>
            </ResponsiveContainer>
            <ChartSummary
                summary={summary}
                tableHeaders={[
                    t("progress.commit_method", "Method"),
                    t("ui.a11y.chart_radar_value", "Score"),
                ]}
                tableRows={data.map((d) => [d.label, round2(d.value)])}
                testid="profile-radar-summary"
            />
        </div>
    );
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
