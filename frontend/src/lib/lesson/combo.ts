/**
 * Lesson combo (#2874) - the pure streak arithmetic behind the
 * game-mode juice package: consecutive correct answers grow the
 * combo, a wrong answer breaks it, the best run of the lesson is
 * kept for the summary. Presentation-only - scoring, SRS and
 * progress never read this.
 */

export interface ComboState {
    /** Correct answers in a row right now. */
    current: number;
    /** Longest run this lesson. */
    best: number;
}

/** The chip renders only from this run length (a single correct
 *  answer is not yet a streak). */
export const COMBO_VISIBLE_FROM = 2;

export function initialCombo(): ComboState {
    return {current: 0, best: 0};
}

/** The next combo state after an answer. */
export function comboAfterAnswer(
    state: ComboState,
    correct: boolean,
): ComboState {
    if (!correct) return {current: 0, best: state.best};
    const current = state.current + 1;
    return {current, best: Math.max(current, state.best)};
}
