/**
 * StreakCalendar — a generic GitHub-style activity heatmap.
 *
 * App-agnostic and props-driven: pass a chronological ``days`` array
 * of ``{date, count}`` and it renders weekly columns of day cells,
 * each tinted by an intensity tier. Colors come from design tokens.
 * Reusable for streaks, contribution graphs, any per-day-count
 * visualization. The caller localizes cell titles + the empty state.
 *
 * @example
 * <StreakCalendar
 *   days={[{date: "2026-06-01", count: 2}, …]}
 *   today="2026-06-15"
 *   cellTitle={(d, c) => `${c} sessions on ${d}`}
 *   emptyLabel="No activity yet."
 * />
 */

export interface StreakDay {
    /** ISO date (YYYY-MM-DD). */
    date: string;
    /** Activity count for the day. */
    count: number;
}

export interface StreakCalendarProps {
    days: StreakDay[];
    /** ISO date of "today" — outlined when present in ``days``. */
    today?: string;
    /** Map a count to an intensity tier 0..4. Default thresholds. */
    tierFor?: (count: number) => number;
    /** Accessible/title text per cell. */
    cellTitle?: (date: string, count: number) => string;
    /** Rendered when ``days`` is empty. */
    emptyLabel?: string;
    /** Accessible name for the whole grid. */
    ariaLabel?: string;
    className?: string;
    testId?: string;
}

function defaultTier(count: number): number {
    if (count <= 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 5) return 3;
    return 4;
}

/** Token-backed background per tier (no hardcoded colors). */
const TIER_BG = [
    "var(--bg-elevated)",
    "color-mix(in oklab, var(--accent) 28%, var(--bg-elevated))",
    "color-mix(in oklab, var(--accent) 50%, var(--bg-elevated))",
    "color-mix(in oklab, var(--accent) 74%, var(--bg-elevated))",
    "var(--accent)",
];

/** Chunk a flat day list into weekly columns of 7. */
function toWeeks(days: StreakDay[]): StreakDay[][] {
    const weeks: StreakDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
    }
    return weeks;
}

export default function StreakCalendar({
    days,
    today,
    tierFor = defaultTier,
    cellTitle = (date, count) => `${count} (${date})`,
    emptyLabel = "No activity yet.",
    ariaLabel,
    className,
    testId = "streak-calendar",
}: StreakCalendarProps) {
    if (days.length === 0) {
        return (
            <p className={className} data-testid={`${testId}-empty`}>
                {emptyLabel}
            </p>
        );
    }

    const weeks = toWeeks(days);

    return (
        <div
            className={className}
            data-testid={testId}
            role="img"
            aria-label={ariaLabel}
            style={{display: "flex", gap: 3, overflowX: "auto"}}
        >
            {weeks.map((week, wi) => (
                <div
                    key={wi}
                    style={{display: "flex", flexDirection: "column", gap: 3}}
                >
                    {week.map((day) => {
                        const tier = Math.min(4, Math.max(0, tierFor(day.count)));
                        const isToday = today != null && day.date === today;
                        return (
                            <span
                                key={day.date}
                                data-testid={`${testId}-cell-${day.date}`}
                                data-tier={tier}
                                data-today={isToday ? "true" : "false"}
                                title={cellTitle(day.date, day.count)}
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 2,
                                    background: TIER_BG[tier],
                                    outline: isToday
                                        ? "2px solid var(--accent)"
                                        : "1px solid var(--border)",
                                    outlineOffset: isToday ? 1 : 0,
                                }}
                            />
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
