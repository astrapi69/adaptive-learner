/**
 * LessonCombo (#2874) - the streak chip of the game-mode juice
 * package, rendered beside the progress bar. Appears from two
 * correct answers in a row, hops on every increment (the mascot's
 * existing keyframe - no new CSS), and simply disappears when the
 * run breaks (the mascot's encourage pose carries that moment).
 * On the summary (``showBest``) it switches to the lesson's best
 * run instead of the live one.
 *
 * Pure presentational: state comes from ``useLessonCombo`` in the
 * lesson page, so chip and summary read the same run.
 *
 * @example
 * <LessonCombo combo={combo} showBest={isSummary} />
 */

import {Flame} from "lucide-react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {
    COMBO_VISIBLE_FROM,
    type ComboState,
} from "../../../lib/lesson/combo";

export interface LessonComboProps {
    combo: ComboState;
    /** Summary mode: show the lesson's best run instead of the live one. */
    showBest?: boolean;
}

export default function LessonCombo({
    combo,
    showBest = false,
}: LessonComboProps) {
    const {t} = useI18n();

    if (showBest) {
        if (combo.best < COMBO_VISIBLE_FROM) return null;
        return (
            <span
                role="status"
                data-testid="lesson-combo-best"
                className="inline-flex shrink-0 items-center gap-1 self-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2 py-0.5 text-sm font-medium text-[var(--fg-primary)]"
            >
                <Flame
                    size={14}
                    aria-hidden="true"
                    className="text-[var(--method-contextual)]"
                />
                {t("lesson.combo_best", "Best streak: {n}").replace(
                    "{n}",
                    String(combo.best),
                )}
            </span>
        );
    }

    if (combo.current < COMBO_VISIBLE_FROM) return null;

    return (
        <span
            key={combo.current}
            role="status"
            aria-label={t("lesson.combo_aria", "Answer streak: {n} in a row").replace(
                "{n}",
                String(combo.current),
            )}
            data-testid="lesson-combo"
            className="inline-flex shrink-0 items-center gap-1 self-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2 py-0.5 text-sm font-semibold text-[var(--method-contextual)] motion-safe:animate-[lernfunke-hop_400ms_ease-out]"
        >
            <Flame size={14} aria-hidden="true" />
            {t("lesson.combo_chip", "x{n}").replace(
                "{n}",
                String(combo.current),
            )}
        </span>
    );
}
