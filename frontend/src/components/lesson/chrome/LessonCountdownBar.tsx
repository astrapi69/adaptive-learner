/**
 * LessonCountdownBar (#1009).
 *
 * The per-question countdown shown at the top of a timed-mode exercise.
 * The fill shrinks from 100% to 0% as time runs out and shifts colour:
 * green (> 50%) → yellow (> 25%) → red (≤ 25%); the last 5 seconds blink
 * to signal urgency. Pure presentation — the player owns the timer.
 *
 * Tailwind + design tokens; works in every theme. ``aria-live`` keeps
 * screen-reader users informed of the remaining seconds without the
 * visual bar.
 */

import {cn} from "@/lib/utils";
import {useI18n} from "../../../hooks/ui/useI18n";

export interface LessonCountdownBarProps {
    /** Whole seconds remaining (clamped to ``[0, total]`` by the caller). */
    remaining: number;
    /** The question's total limit in seconds (the bar's 100%). */
    total: number;
}

/** Resolve the fill colour token from the remaining fraction. */
function fillColor(fraction: number): string {
    if (fraction > 0.5) return "var(--exercise-correct)";
    if (fraction > 0.25) return "var(--warning)";
    return "var(--exercise-wrong)";
}

/**
 * Render the countdown bar.
 *
 * @param props - See {@link LessonCountdownBarProps}.
 */
export default function LessonCountdownBar({
    remaining,
    total,
}: LessonCountdownBarProps) {
    const {t} = useI18n();
    const safeTotal = Math.max(1, total);
    const clamped = Math.max(0, Math.min(remaining, safeTotal));
    const fraction = clamped / safeTotal;
    const pct = Math.round(fraction * 100);
    // Blink in the final 5 seconds (motion-safe so reduced-motion users
    // just see the red bar without the pulse).
    const urgent = clamped <= 5;

    return (
        <div
            className="px-2 py-1"
            data-testid="lesson-countdown"
            data-remaining={clamped}
            data-urgent={urgent}
        >
            <div
                className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={safeTotal}
                aria-valuenow={clamped}
                aria-label={t("lesson.timed.remaining", "Time remaining")}
            >
                <div
                    className={cn(
                        "h-full rounded-full transition-[width] duration-1000 ease-linear",
                        urgent && "motion-safe:animate-pulse",
                    )}
                    style={{
                        width: `${pct}%`,
                        backgroundColor: fillColor(fraction),
                    }}
                    data-testid="lesson-countdown-fill"
                />
            </div>
            <span
                className="sr-only"
                role="status"
                aria-live="polite"
                data-testid="lesson-countdown-sr"
            >
                {t("lesson.timed.seconds_left", "{n}s left").replace(
                    "{n}",
                    String(clamped),
                )}
            </span>
        </div>
    );
}
