/**
 * ElementProgressBar — a compact "X / Y mastered" indicator: a count
 * plus a determinate bar.
 *
 * App-agnostic and props-driven: it reuses the shared
 * {@link ProgressBar} and takes a caller-supplied accessible label; no
 * i18n/storage imports. Reusable for any "N of M complete" mastery
 * readout.
 *
 * @example
 * <ElementProgressBar mastered={3} total={8} ariaLabel="3 of 8 elements mastered" />
 */

import ProgressBar from "../data-display/ProgressBar";

export interface ElementProgressBarProps {
    mastered: number;
    total: number;
    /** Accessible name for the bar (e.g. "3 of 8 elements mastered"). */
    ariaLabel: string;
    testId?: string;
}

/** "X / Y" mastery count + bar (presentational, token-backed). */
export default function ElementProgressBar({
    mastered,
    total,
    ariaLabel,
    testId,
}: ElementProgressBarProps) {
    const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return (
        <span
            className="inline-flex items-center gap-2"
            data-testid={testId}
        >
            <span className="text-xs tabular-nums text-fg-muted">
                {mastered}/{total}
            </span>
            <ProgressBar
                valueNow={percent}
                ariaLabel={ariaLabel}
                className="relative h-1.5 w-16 overflow-hidden rounded-full bg-bg-secondary"
                fillClassName="h-full rounded-full bg-success"
                labelClassName="sr-only"
            >
                {percent}%
            </ProgressBar>
        </span>
    );
}
