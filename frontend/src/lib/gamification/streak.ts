/**
 * Activity-date streak helper (Phase 50C / v1.33.0 /
 * D-DEXIE-GAMIFICATION).
 *
 * TypeScript port of ``current_streak_days`` from
 * ``plugins/adaptive-learner-plugin-gamification/
 *   adaptive_learner_gamification/xp_service.py``. Pure function
 * over a set of calendar dates — used in Dexie mode where the
 * caller derives activity_dates from
 * ``db.learningSessions.toArray()`` filtered to the user's
 * projects (handover § 2.1 decision: simple JS-side filter, not
 * a Dexie ``where`` query — data sets are small).
 *
 * The Python side uses ``set[date]``; this port uses
 * ``Set<string>`` of ISO calendar dates (YYYY-MM-DD) to avoid
 * Date instance-comparison pitfalls. The parity contract is on
 * the integer OUTPUT, not on the input type. Both languages
 * produce the same streak count for the same logical activity
 * set.
 *
 * Pinned by the parity fixture at
 * ``tests/fixtures/lesson-xp-parity/input.json``
 * (``streak_cases``) — see ``streak.parity.test.ts``.
 */

/**
 * Subtract one calendar day from an ISO date string, in UTC.
 * Uses ``Date.UTC`` to avoid timezone-induced off-by-one
 * surprises when the local TZ has a non-zero offset.
 */
function subtractOneDay(iso_date: string): string {
    const parts = iso_date.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    const stamp = new Date(Date.UTC(year, month - 1, day));
    stamp.setUTCDate(stamp.getUTCDate() - 1);
    const yyyy = stamp.getUTCFullYear().toString().padStart(4, "0");
    const mm = (stamp.getUTCMonth() + 1).toString().padStart(2, "0");
    const dd = stamp.getUTCDate().toString().padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Count consecutive calendar days ending at ``today`` that
 * appear in ``activity_dates``. Returns 0 if ``today`` itself
 * has no activity. Mirrors the Python loop exactly: walk
 * backwards from ``today`` while each day is in the set.
 *
 * ``today`` is required (no default) — Dexie callers should
 * pass a UTC YYYY-MM-DD computed at the call site so the test
 * remains hermetic.
 */
export function currentStreakDays(
    activity_dates: Set<string>,
    today: string,
): number {
    if (!activity_dates.has(today)) {
        return 0;
    }
    let streak = 0;
    let cursor = today;
    while (activity_dates.has(cursor)) {
        streak += 1;
        cursor = subtractOneDay(cursor);
    }
    return streak;
}
