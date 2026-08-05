/**
 * Real-browser concurrency probe (#2283).
 *
 * The three Dexie concurrency pins (``dexie-rmw-concurrency``,
 * ``dexie-create-race``, ``dexie-fullreplace-concurrency``) run against
 * ``fake-indexeddb`` and therefore ASSUME that the fake reproduces a real
 * browser's IndexedDB transaction serialization. This module lets the
 * Playwright cell ``e2e/dexie/dexie-concurrency.spec.ts`` fire the SAME
 * storage-layer calls concurrently inside real Chromium against real
 * IndexedDB, converting that assumption into a measurement.
 *
 * Loaded via dynamic import from ``main.tsx`` ONLY when the page URL
 * carries ``?e2e-hooks=1`` - a normal visit never loads this chunk. The
 * probe writes only under its own ``u-e2e-*`` user ids.
 */

import {getDb, nowIso} from "./db";
import {getXPState, persistXP} from "../gamification/gamification";
import {
    getLessonProgressDexie,
    upsertLessonProgressDexie,
} from "../lessons/lesson-progress-dexie";
import {
    listElementErrorsDexie,
    recordElementAttemptsDexie,
} from "../lessons/element-errors-dexie";

async function seedUser(userId: string): Promise<void> {
    await getDb().users.put({
        id: userId,
        name: "E2E Concurrency",
        email: null,
        language: "en",
        created_at: nowIso(),
        updated_at: nowIso(),
    });
}

/** Two concurrent +10 XP awards on one user; returns the resulting total
 *  (20 when no increment was lost, 10 on a lost update, 0 when the
 *  storage layer never wrote - the fail-closed signal). */
async function persistXpPair(userId: string): Promise<number> {
    await seedUser(userId);
    await getDb().userXp.put({
        id: `xp-${userId}`,
        user_id: userId,
        total_xp: 0,
        level: 1,
        updated_at: nowIso(),
    });
    await Promise.all([persistXP(userId, 10), persistXP(userId, 10)]);
    return (await getXPState(userId)).total_xp;
}

/** Two concurrent step_results on one lesson-progress row; returns the
 *  surviving step ids (sorted) and the score total. */
async function lessonProgressPair(
    userId: string,
): Promise<{stepIds: string[]; scoreTotal: number}> {
    await seedUser(userId);
    const base = {
        source: "bundled:e2e",
        set_id: "s-e2e",
        lesson_filename: "l1.json",
    };
    await Promise.all([
        upsertLessonProgressDexie(userId, {
            ...base,
            step_result: {step_id: "a", correct: 1, total: 1},
        }),
        upsertLessonProgressDexie(userId, {
            ...base,
            step_result: {step_id: "b", correct: 1, total: 1},
        }),
    ]);
    const row = await getLessonProgressDexie(
        userId,
        base.source,
        base.set_id,
        base.lesson_filename,
    );
    if (!row) return {stepIds: [], scoreTotal: 0};
    return {
        stepIds: Object.keys(row.step_results).sort(),
        scoreTotal: row.score_total,
    };
}

/** Two concurrent identical correct attempts on one element key; returns
 *  the row count for the user (unique-index create race: must be 1) and
 *  the accumulated correct streak (must be 2). */
async function elementAttemptPair(
    userId: string,
): Promise<{rows: number; correctStreak: number}> {
    await seedUser(userId);
    const attempt = {
        set_id: "s-e2e",
        lesson_id: "l-e2e",
        exercise_id: "e1",
        element_key: "k1",
        correct: true,
    };
    await Promise.all([
        recordElementAttemptsDexie(userId, [attempt]),
        recordElementAttemptsDexie(userId, [attempt]),
    ]);
    const rows = await listElementErrorsDexie(userId);
    return {
        rows: rows.length,
        correctStreak: rows[0]?.correct_streak ?? 0,
    };
}

export interface ConcurrencyProbe {
    persistXpPair: typeof persistXpPair;
    lessonProgressPair: typeof lessonProgressPair;
    elementAttemptPair: typeof elementAttemptPair;
}

(
    window as unknown as {__alConcurrencyProbe?: ConcurrencyProbe}
).__alConcurrencyProbe = {
    persistXpPair,
    lessonProgressPair,
    elementAttemptPair,
};
