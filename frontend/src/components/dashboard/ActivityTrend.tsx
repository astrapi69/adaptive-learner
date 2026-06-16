/**
 * ActivityTrend — a 7-day learning-activity sparkline + a
 * week-over-week trend indicator, derived from the streak heatmap.
 *
 * There is no per-day XP series, so this surfaces learning *momentum*
 * honestly from the session-count heatmap the gamification layer
 * already provides. Presentational: the parent passes the heatmap
 * entries. Renders the last 7 days through the reusable
 * ``shared/StreakCalendar`` and compares the last 7 days' total with
 * the previous 7.
 */

import {Minus, TrendingDown, TrendingUp} from "lucide-react";

import {useI18n} from "../../hooks/useI18n";
import StreakCalendar from "../../shared/StreakCalendar";
import type {HeatmapEntryOut} from "../../storage/types";

interface ActivityTrendProps {
    entries: HeatmapEntryOut[] | null;
}

function sum(entries: HeatmapEntryOut[]): number {
    return entries.reduce((acc, e) => acc + e.count, 0);
}

export default function ActivityTrend({entries}: ActivityTrendProps) {
    const {t} = useI18n();
    if (!entries || entries.length === 0) {
        return null;
    }

    const last7 = entries.slice(-7);
    const prev7 = entries.slice(-14, -7);
    const lastTotal = sum(last7);
    const prevTotal = sum(prev7);
    const today = new Date().toISOString().slice(0, 10);

    const direction: "up" | "down" | "flat" =
        lastTotal > prevTotal ? "up" : lastTotal < prevTotal ? "down" : "flat";

    const trend = {
        up: {
            Icon: TrendingUp,
            label: t("gamification.trend_up", "More than last week"),
            color: "var(--success-fg, var(--accent))",
        },
        down: {
            Icon: TrendingDown,
            label: t("gamification.trend_down", "Less than last week"),
            color: "var(--fg-muted)",
        },
        flat: {
            Icon: Minus,
            label: t("gamification.trend_flat", "Same as last week"),
            color: "var(--fg-muted)",
        },
    }[direction];

    const {Icon} = trend;

    return (
        <div className="activity-trend" data-testid="activity-trend">
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                }}
            >
                <span
                    style={{fontSize: "0.8125rem", color: "var(--fg-muted)"}}
                >
                    {t("gamification.activity_7d", "Activity (last 7 days)")}
                </span>
                <span
                    data-testid="activity-trend-indicator"
                    data-direction={direction}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "0.8125rem",
                        color: trend.color,
                    }}
                >
                    <Icon size={14} aria-hidden="true" />
                    {trend.label}
                </span>
            </div>
            <StreakCalendar
                days={last7.map((e) => ({date: e.date, count: e.count}))}
                today={today}
                ariaLabel={t(
                    "gamification.activity_7d",
                    "Activity (last 7 days)",
                )}
                cellTitle={(date, count) =>
                    t("gamification.activity_cell", "{count} on {date}")
                        .replace("{count}", String(count))
                        .replace("{date}", date)
                }
                testId="activity-sparkline"
            />
        </div>
    );
}
