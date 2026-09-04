/**
 * LessonCountdownRing (#2878) - the game-mode per-exercise timer ring.
 *
 * A small SVG ring beside the combo chip whose stroke empties as the
 * step's time runs out, colour-staged like the timed-mode bar (green >
 * 50%, yellow > 25%, red at the end) with a motion-safe pulse in the
 * final five seconds. Pure presentation - ``useLessonCountdown`` owns
 * the timer; after expiry the ring shows 0 and stops (the step stays
 * playable, see the hook).
 */

import {useI18n} from "../../../../hooks/ui/useI18n";
import {cn} from "@/lib/utils";

export interface LessonCountdownRingProps {
    /** Whole seconds remaining. */
    remaining: number;
    /** The ring's full length in seconds. */
    total: number;
    /** True once this step's time ran out. */
    expired: boolean;
}

/** Resolve the stroke colour token from the remaining fraction. */
function ringColor(fraction: number): string {
    if (fraction > 0.5) return "var(--exercise-correct)";
    if (fraction > 0.25) return "var(--warning)";
    return "var(--exercise-wrong)";
}

const RADIUS = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function LessonCountdownRing({
    remaining,
    total,
    expired,
}: LessonCountdownRingProps) {
    const {t} = useI18n();
    const safeTotal = Math.max(1, total);
    const clamped = Math.max(0, Math.min(remaining, safeTotal));
    const fraction = clamped / safeTotal;
    const urgent = !expired && clamped <= 5;
    return (
        <span
            className={cn(
                "relative inline-flex size-9 items-center justify-center",
                urgent && "motion-safe:animate-pulse",
            )}
            role="timer"
            aria-label={t("lesson.countdown.aria", "Time ring: {n}s left").replace(
                "{n}",
                String(clamped),
            )}
            data-testid="lesson-countdown-ring"
            data-remaining={clamped}
            data-expired={expired}
        >
            <svg viewBox="0 0 32 32" className="size-9 -rotate-90" aria-hidden="true">
                <circle
                    cx="16"
                    cy="16"
                    r={RADIUS}
                    fill="none"
                    stroke="var(--bg-elevated)"
                    strokeWidth="3"
                />
                <circle
                    cx="16"
                    cy="16"
                    r={RADIUS}
                    fill="none"
                    stroke={ringColor(fraction)}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
                    className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                    data-testid="lesson-countdown-ring-fill"
                />
            </svg>
            <span
                className="absolute text-[0.625rem] font-semibold tabular-nums text-[var(--fg-primary)]"
                data-testid="lesson-countdown-ring-seconds"
            >
                {clamped}
            </span>
        </span>
    );
}
