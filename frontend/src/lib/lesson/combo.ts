/**
 * Lesson combo (#2874) - the pure streak arithmetic behind the
 * game-mode juice package: consecutive correct answers grow the
 * combo, a wrong answer breaks it, the best run of the lesson is
 * kept for the summary.
 *
 * #2893 adds the one deliberate exception to "presentation-only":
 * ``bonusEligible`` counts the answers given at streak length 3 or
 * more - the raw input of the decided combo-bonus XP. The counter
 * itself is uncapped; the user-configured cap and the hard ceiling
 * are applied by the XP layer (``calculateLessonSessionXp``).
 */

export interface ComboState {
    /** Correct answers in a row right now. */
    current: number;
    /** Longest run this lesson. */
    best: number;
    /** #2893 - correct answers given at streak length >= 3 (the
     *  third streak answer earns the first bonus point). */
    bonusEligible: number;
}

/** The chip renders only from this run length (a single correct
 *  answer is not yet a streak). */
export const COMBO_VISIBLE_FROM = 2;

/** The streak length from which an answer earns a bonus point. */
export const COMBO_BONUS_FROM = 3;

export function initialCombo(): ComboState {
    return {current: 0, best: 0, bonusEligible: 0};
}

/** The next combo state after an answer. */
export function comboAfterAnswer(
    state: ComboState,
    correct: boolean,
): ComboState {
    if (!correct) {
        return {current: 0, best: state.best, bonusEligible: state.bonusEligible};
    }
    const current = state.current + 1;
    return {
        current,
        best: Math.max(current, state.best),
        bonusEligible:
            state.bonusEligible + (current >= COMBO_BONUS_FROM ? 1 : 0),
    };
}
