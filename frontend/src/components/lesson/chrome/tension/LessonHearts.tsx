/**
 * LessonHearts (#2878) - the game-mode lives display.
 *
 * A row of hearts next to the combo chip: filled while alive, hollow
 * once lost. Pure presentation - ``useLessonHearts`` owns the count.
 * Losing a heart replays a short shake on the row (``motion-safe``,
 * keyed by the remaining count so reduced-motion users just see the
 * hollow heart).
 */

import {Heart} from "lucide-react";

import {useI18n} from "../../../../hooks/ui/useI18n";

export interface LessonHeartsProps {
    /** Remaining lives. */
    hearts: number;
    /** The run's configured maximum. */
    maxHearts: number;
}

export default function LessonHearts({hearts, maxHearts}: LessonHeartsProps) {
    const {t} = useI18n();
    const label = t("lesson.hearts.aria", "Lives: {n} of {max}")
        .replace("{n}", String(hearts))
        .replace("{max}", String(maxHearts));
    return (
        <span
            key={hearts}
            role="status"
            aria-label={label}
            title={label}
            data-testid="lesson-hearts"
            data-hearts={hearts}
            className={
                hearts < maxHearts
                    ? "inline-flex items-center gap-0.5 motion-safe:animate-[matching-shake_300ms_ease-in-out]"
                    : "inline-flex items-center gap-0.5"
            }
        >
            {Array.from({length: maxHearts}, (_, i) => {
                const filled = i < hearts;
                return (
                    <Heart
                        key={i}
                        size={16}
                        aria-hidden="true"
                        data-testid={`lesson-heart-${i}`}
                        data-filled={filled}
                        className={
                            filled
                                ? "text-[var(--danger)]"
                                : "text-[var(--fg-muted)] opacity-60"
                        }
                        fill={filled ? "currentColor" : "none"}
                    />
                );
            })}
        </span>
    );
}
