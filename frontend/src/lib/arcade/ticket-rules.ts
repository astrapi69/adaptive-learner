/**
 * Pure ticket-award rules (#2889) - the game-mode arcade's
 * performance economy. A run earns one ticket per met condition:
 * a full-score lesson (first-pass, so the correction round can
 * never turn a run perfect after the fact) and a run survived with
 * all hearts (#2878). Streak milestones are derived separately so
 * the store can dedupe them per user. Exam mode uses the same
 * full-score rule; the error-replay/correction surfaces never call
 * these (they award nothing by construction).
 */

/** The streak-day ladder that grants one bonus ticket each. */
export const TICKET_STREAK_MILESTONES = [3, 7, 14, 30] as const;

export interface TicketRunInput {
    /** First-pass correct count (the frozen ``score_correct``). */
    scoreCorrect: number;
    /** First-pass total (0 for an unscored run - earns nothing). */
    scoreTotal: number;
    /** The hearts system was active AND no heart was lost (#2878). */
    fullHeartsRun: boolean;
}

/**
 * Tickets earned by one completed lesson run (0-2).
 *
 * @example
 * ticketsForRun({scoreCorrect: 10, scoreTotal: 10, fullHeartsRun: true})
 * // 2
 */
export function ticketsForRun(input: TicketRunInput): number {
    const fullScore =
        input.scoreTotal > 0 && input.scoreCorrect === input.scoreTotal;
    return (fullScore ? 1 : 0) + (input.fullHeartsRun ? 1 : 0);
}

/**
 * The streak milestones newly reached by ``streakDays`` that are not
 * in ``alreadyAwarded`` yet, in ladder order.
 *
 * @example
 * newStreakMilestones(8, [3]) // [7]
 */
export function newStreakMilestones(
    streakDays: number,
    alreadyAwarded: readonly number[],
): number[] {
    return TICKET_STREAK_MILESTONES.filter(
        (m) => streakDays >= m && !alreadyAwarded.includes(m),
    );
}
