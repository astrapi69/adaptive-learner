/**
 * ActivityHeatmap — a GitHub-style contribution grid: weekly columns of
 * seven daily cells (Mon..Sun), each tinted by an intensity tier
 * derived from its count.
 *
 * App-agnostic and props-driven: the caller supplies a dense
 * ``{date, count}`` series (one entry per day, gaps filled with count
 * 0), an accessible name, and a ``cellLabel`` formatter for the
 * per-cell title/aria text. No i18n, storage, or app imports. Tiers
 * are token-backed Tailwind utilities, so the grid recolors across
 * every theme. Reusable for streaks, lessons-per-day, commits-per-day,
 * any daily-count visual.
 *
 * @example
 * <ActivityHeatmap
 *   data={[{date: "2026-06-01", count: 0}, {date: "2026-06-02", count: 3}]}
 *   ariaLabel="Lessons completed per day, last 90 days"
 *   cellLabel={(date, count) => `${count} lessons on ${date}`}
 *   emptyLabel="No activity yet."
 *   testId="lesson-activity-heatmap"
 * />
 */

/** A single day in the heatmap series. */
export interface ActivityHeatmapDay {
    /** ``YYYY-MM-DD``. An empty string marks a padding cell. */
    date: string;
    /** Count for the day; drives the colour tier. */
    count: number;
}

export interface ActivityHeatmapProps {
    /** Dense daily series (gaps filled with count 0). */
    data: readonly ActivityHeatmapDay[];
    /** Accessible name for the whole grid. */
    ariaLabel: string;
    /** Builds the per-cell title + aria-label from a date + count. */
    cellLabel: (date: string, count: number) => string;
    /** Shown when ``data`` is empty. */
    emptyLabel: string;
    /** Upper bounds (inclusive) for tiers 1..3; counts above the last
     *  bound land in the top tier. Defaults to ``[1, 3, 5]``. */
    tierBounds?: readonly [number, number, number];
    /** ``data-testid`` for the grid root. */
    testId?: string;
}

const TIER_CLASS = [
    "bg-bg-secondary",
    "bg-accent/30",
    "bg-accent/55",
    "bg-accent/80",
    "bg-accent",
] as const;

function tierForCount(
    count: number,
    bounds: readonly [number, number, number],
): number {
    if (count <= 0) return 0;
    if (count <= bounds[0]) return 1;
    if (count <= bounds[1]) return 2;
    if (count <= bounds[2]) return 3;
    return 4;
}

/** Group the flat day series into Monday-aligned weekly columns. */
function toWeeks(
    data: readonly ActivityHeatmapDay[],
): ActivityHeatmapDay[][] {
    const weeks: ActivityHeatmapDay[][] = [];
    let week: ActivityHeatmapDay[] = [];
    for (const entry of data) {
        const dow = (new Date(`${entry.date}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon=0..Sun=6
        if (week.length === 0 && dow > 0) {
            for (let i = 0; i < dow; i++) week.push({date: "", count: 0});
        }
        week.push(entry);
        if (dow === 6) {
            weeks.push(week);
            week = [];
        }
    }
    if (week.length > 0) {
        while (week.length < 7) week.push({date: "", count: 0});
        weeks.push(week);
    }
    return weeks;
}

/** GitHub-style daily-count heatmap (presentational, token-backed). */
export default function ActivityHeatmap({
    data,
    ariaLabel,
    cellLabel,
    emptyLabel,
    tierBounds = [1, 3, 5],
    testId,
}: ActivityHeatmapProps) {
    if (data.length === 0) {
        return (
            <p className="text-sm text-fg-muted" data-testid={testId}>
                {emptyLabel}
            </p>
        );
    }
    const weeks = toWeeks(data);
    return (
        <div
            className="flex gap-1 overflow-x-auto"
            role="img"
            aria-label={ariaLabel}
            data-testid={testId}
        >
            {weeks.map((week, wIdx) => (
                <div className="flex flex-col gap-1" key={wIdx}>
                    {week.map((cell, cIdx) => {
                        if (cell.date === "") {
                            return (
                                <div
                                    key={`${wIdx}-${cIdx}`}
                                    className="h-3 w-3 rounded-sm"
                                    aria-hidden="true"
                                />
                            );
                        }
                        const tier = tierForCount(cell.count, tierBounds);
                        const label = cellLabel(cell.date, cell.count);
                        return (
                            <div
                                key={`${wIdx}-${cIdx}`}
                                className={`h-3 w-3 rounded-sm border border-border-subtle ${TIER_CLASS[tier]}`}
                                title={label}
                                aria-label={label}
                                role="img"
                                data-testid={`activity-cell-${cell.date}`}
                                data-tier={tier}
                            />
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
