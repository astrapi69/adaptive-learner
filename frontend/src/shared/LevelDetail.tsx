/**
 * LevelDetail — a compact level-progress panel: the current level, a
 * progress bar toward the next level, and an "{n} XP to next level"
 * line (or a "max level" note). Presentational + app-agnostic: every
 * value and label is caller-supplied; no i18n / storage imports.
 *
 * Drives the nav XP badge's level-detail popover (#730), but reusable
 * anywhere the level-progress detail is wanted (a dashboard card, a
 * profile view).
 *
 * @example
 * <LevelDetail
 *   level={4}
 *   xpIntoLevel={120}
 *   xpToNext={80}
 *   levelLabel="Level"
 *   toNextLabel="80 XP to next level"
 * />
 */

export interface LevelDetailProps {
    /** Current level number. */
    level: number;
    /** XP accumulated within the current level. */
    xpIntoLevel: number;
    /** XP still needed to reach the next level (0 = max level). */
    xpToNext: number;
    /** Word before the level number, e.g. "Level". */
    levelLabel: string;
    /** Pre-formatted "{n} XP to next level" line, or the max-level note
     *  when ``xpToNext`` is 0. */
    toNextLabel: string;
    /** Accessible name for the progress bar. */
    progressAriaLabel?: string;
    testId?: string;
}

/** Level + progress-bar + to-next-level detail (presentational). */
export default function LevelDetail({
    level,
    xpIntoLevel,
    xpToNext,
    levelLabel,
    toNextLabel,
    progressAriaLabel,
    testId = "level-detail",
}: LevelDetailProps) {
    const span = xpIntoLevel + xpToNext;
    const pct = span > 0 ? Math.round((xpIntoLevel / span) * 100) : 100;
    return (
        <div
            className="flex min-w-[12rem] flex-col gap-2"
            data-testid={testId}
        >
            <div className="text-sm font-semibold text-fg-primary">
                {levelLabel} {level}
            </div>
            <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label={progressAriaLabel}
                data-testid={`${testId}-bar`}
            >
                <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div
                className="text-xs text-fg-secondary"
                data-testid={`${testId}-tonext`}
            >
                {toNextLabel}
            </div>
        </div>
    );
}
