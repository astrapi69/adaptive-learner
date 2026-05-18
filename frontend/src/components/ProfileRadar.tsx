import {
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
} from "recharts";

import {useI18n} from "../hooks/useI18n";
import {LEARNING_METHODS, METHOD_COLORS} from "../lib/constants";
import type {LearningProfile} from "../types";

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
    const data = LEARNING_METHODS.map((method) => ({
        method,
        label: t(`methods.${method}.label`, method),
        value: profile[method],
    }));
    return (
        <div
            className="profile-radar"
            data-testid="profile-radar"
            style={{width: "100%", height}}
        >
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                    data={data}
                >
                    <PolarGrid />
                    <PolarAngleAxis dataKey="label" />
                    <PolarRadiusAxis
                        angle={90}
                        domain={[0, 1]}
                        tickCount={5}
                    />
                    <Radar
                        name="profile"
                        dataKey="value"
                        stroke={METHOD_COLORS[profile.dominant_method] ?? "#6366f1"}
                        fill={METHOD_COLORS[profile.dominant_method] ?? "#6366f1"}
                        fillOpacity={0.32}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
