/**
 * Streak calendar heatmap (Phase 29C / v1.16.0).
 *
 * Renders a GitHub-style contribution grid: ~52 weekly columns
 * by 7 daily rows (Mon..Sun). Each cell's color tier reflects
 * the session count for that day. Tooltip via ``title`` attr
 * carries the date + count; the surrounding ``StreakWidget``
 * shows current/longest streak + freeze stock.
 *
 * The heatmap is purely presentational — the parent fetches
 * the data via ``storage.gamification.getStreakHeatmap`` and
 * passes it through here.
 */

import {useI18n} from "../hooks/useI18n";
import type {HeatmapEntryOut} from "../storage/types";

function tierForCount(count: number): number {
    if (count <= 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 5) return 3;
    return 4;
}

interface StreakCalendarProps {
    entries: HeatmapEntryOut[] | null;
}

export default function StreakCalendar({entries}: StreakCalendarProps) {
    const {t} = useI18n();
    if (!entries) {
        return (
            <div
                className="streak-calendar streak-calendar--loading"
                data-testid="streak-calendar-loading"
            >
                <p className="muted" role="status">{t("common.loading", "Loading…")}</p>
            </div>
        );
    }
    if (entries.length === 0) {
        return (
            <div
                className="streak-calendar streak-calendar--empty"
                data-testid="streak-calendar-empty"
            >
                <p className="muted">
                    {t(
                        "gamification.streak_no_data",
                        "Start a session to begin your streak.",
                    )}
                </p>
            </div>
        );
    }
    // Group into weekly columns. Each entry's UTC day-of-week
    // (Mon=0 .. Sun=6) determines its row in the column.
    const weeks: HeatmapEntryOut[][] = [];
    let currentWeek: HeatmapEntryOut[] = [];
    for (const entry of entries) {
        const dow = (new Date(`${entry.date}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
        if (currentWeek.length === 0 && dow > 0) {
            // Pad front of first week with empties so the grid
            // aligns to the Monday row.
            for (let i = 0; i < dow; i++) {
                currentWeek.push({date: "", count: 0});
            }
        }
        currentWeek.push(entry);
        if (dow === 6) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    }
    if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
            currentWeek.push({date: "", count: 0});
        }
        weeks.push(currentWeek);
    }
    return (
        <div
            className="streak-calendar"
            role="img"
            aria-label={t("gamification.streak_calendar", "Activity heatmap")}
            data-testid="streak-calendar"
        >
            {weeks.map((week, wIdx) => (
                <div className="streak-calendar__week" key={wIdx}>
                    {week.map((cell, cIdx) => (
                        <div
                            key={`${wIdx}-${cIdx}`}
                            className={
                                "streak-cell " +
                                (cell.date === ""
                                    ? "streak-cell--empty"
                                    : `streak-cell--tier-${tierForCount(cell.count)}`)
                            }
                            title={
                                cell.date === ""
                                    ? ""
                                    : `${cell.date} — ${cell.count}`
                            }
                            data-testid={
                                cell.date !== ""
                                    ? `streak-cell-${cell.date}`
                                    : undefined
                            }
                            data-tier={tierForCount(cell.count)}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}
