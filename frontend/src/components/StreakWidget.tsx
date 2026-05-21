/**
 * Streak widget header (Phase 29C / v1.16.0).
 *
 * Compact summary that sits above the heatmap: current streak,
 * longest streak, freeze inventory. The dashboard places this
 * + ``StreakCalendar`` in the same card.
 */

import {useI18n} from "../hooks/useI18n";
import type {StreakStateOut} from "../storage/types";

interface StreakWidgetProps {
    state: StreakStateOut | null;
}

export default function StreakWidget({state}: StreakWidgetProps) {
    const {t} = useI18n();
    if (!state) {
        return null;
    }
    return (
        <div className="streak-widget" data-testid="streak-widget">
            <div className="streak-widget__cell">
                <span className="streak-widget__label">
                    {t("gamification.current_streak", "Current streak")}
                </span>
                <span
                    className="streak-widget__value"
                    data-testid="streak-widget-current"
                >
                    {state.current_streak_days}
                </span>
            </div>
            <div className="streak-widget__cell">
                <span className="streak-widget__label">
                    {t("gamification.longest_streak", "Longest streak")}
                </span>
                <span
                    className="streak-widget__value"
                    data-testid="streak-widget-longest"
                >
                    {state.longest_streak_days}
                </span>
            </div>
            <div className="streak-widget__cell">
                <span className="streak-widget__label">
                    {t("gamification.freezes_available", "Freezes available")}
                </span>
                <span
                    className="streak-widget__value"
                    data-testid="streak-widget-freezes"
                >
                    {state.freezes_available}
                </span>
            </div>
        </div>
    );
}
