/**
 * Display helpers for an Endless run (#1015), shared by the running stat
 * line in the runner shell and the end-of-run recap (EXP-052 slice 2).
 * Both used to carry a private copy each inside ``EndlessLesson.tsx``.
 *
 * @example
 * formatDuration(754); // "12:34"
 * hitRatePercent({cards: 45, correct: 38}); // 84
 */

/** ``m:ss`` for a whole-second duration (minutes are not capped at 59). */
export function formatDuration(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

/** Share of correct answers among answered cards, rounded; 0 before the first card. */
export function hitRatePercent(stats: {cards: number; correct: number}): number {
    return stats.cards > 0 ? Math.round((stats.correct / stats.cards) * 100) : 0;
}
