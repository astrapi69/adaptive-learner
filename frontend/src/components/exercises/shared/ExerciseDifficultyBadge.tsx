/**
 * Difficulty indicator (#1693 / Option B from #1599): a small, glanceable
 * badge that names an exercise's authored difficulty. It is pure transparency
 * — it explains *why* the adaptive generator may surface a card earlier or
 * more often (Option A, #1599/PR #1683, seeds the pool from the same
 * ``card.difficulty`` prior). It NEVER changes scheduling or scoring.
 *
 * The level (1-5) is derived in ``ExerciseDispatcher`` from the exercise's
 * referenced cards (``resolveDifficulty``) — the same "derive in the
 * dispatcher from the cards prop" shape as ``resolveListenAudio`` (#1600/PR
 * #1687), so no new prop needs threading through the lesson pages.
 *
 * When no referenced card carries an authored difficulty the dispatcher
 * passes ``null`` and this component renders NOTHING — the entire
 * pre-#1693 corpus (cards without difficulty) looks exactly as before.
 * Authored difficulty is an enhancement, never a gate.
 *
 * Accessibility: the level is conveyed by a tier WORD plus a 5-segment
 * meter (filled/unfilled), never by colour alone. The full description
 * ("Difficulty: Medium (3 of 5)") lives on the badge's ``aria-label`` and
 * ``title``; the decorative meter is ``aria-hidden``.
 */

import {SignalHigh} from "lucide-react";

import {useI18n} from "../../../hooks/ui/useI18n";

export interface ExerciseDifficultyBadgeProps {
    /** Authored difficulty 1-5, or null when no referenced card carries a
     *  valid value (the entire pre-#1693 corpus). */
    level: number | null;
}

/** Map a 1-5 difficulty to a coarse tier so the badge is understandable at a
 *  glance without the learner having to decode a bare number. 1-2 easy,
 *  3 medium, 4-5 hard. */
function tierFor(level: number): "easy" | "medium" | "hard" {
    if (level <= 2) return "easy";
    if (level === 3) return "medium";
    return "hard";
}

const TIER_FALLBACK: Record<"easy" | "medium" | "hard", string> = {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
};

const METER_SEGMENTS = [1, 2, 3, 4, 5];

export default function ExerciseDifficultyBadge({
    level,
}: ExerciseDifficultyBadgeProps) {
    const {t} = useI18n();

    if (
        level === null ||
        !Number.isInteger(level) ||
        level < 1 ||
        level > 5
    ) {
        return null;
    }

    const tier = tierFor(level);
    const tierLabel = t(
        `exercise.difficulty.tier.${tier}`,
        TIER_FALLBACK[tier],
    );
    const aria = t(
        "exercise.difficulty.aria",
        "Difficulty: {tier} ({level} of 5)",
    )
        .replace("{tier}", tierLabel)
        .replace("{level}", String(level));

    return (
        <div
            className="mb-3 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-elevated px-2.5 py-1 text-xs font-medium text-fg-secondary"
            data-testid="difficulty-badge"
            data-difficulty={level}
            role="img"
            aria-label={aria}
            title={aria}
        >
            <SignalHigh aria-hidden="true" size={14} />
            <span data-testid="difficulty-badge-tier">{tierLabel}</span>
            <span
                className="inline-flex items-center gap-0.5"
                aria-hidden="true"
            >
                {METER_SEGMENTS.map((segment) => (
                    <span
                        key={segment}
                        className={
                            "h-1.5 w-1.5 rounded-full " +
                            (segment <= level
                                ? "bg-accent"
                                : "bg-border-subtle")
                        }
                    />
                ))}
            </span>
        </div>
    );
}
