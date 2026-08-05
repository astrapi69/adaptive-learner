/**
 * Real-browser concurrency cell (#2283) - Dexie mode, NO backend.
 *
 * The three unit concurrency pins (``dexie-rmw-concurrency``,
 * ``dexie-create-race``, ``dexie-fullreplace-concurrency``) prove the
 * read-modify-write discipline against ``fake-indexeddb`` and assume the
 * fake reproduces a real browser's IndexedDB transaction serialization.
 * This cell fires the SAME storage-layer calls concurrently inside real
 * Chromium (via the ``?e2e-hooks=1`` probe, ``e2e-concurrency-hooks.ts``)
 * so that assumption is a measurement, not a comment.
 *
 * Gate contract (quality-checks.md): the test reports how many concurrent
 * pairs it fired, and it fails CLOSED when the storage layer never wrote -
 * every assertion demands the written value, so "no rows" can never read
 * as a pass.
 */

import {expect, test, type Page} from "@playwright/test";

interface ConcurrencyProbeHandle {
    persistXpPair(userId: string): Promise<number>;
    lessonProgressPair(
        userId: string,
    ): Promise<{stepIds: string[]; scoreTotal: number}>;
    elementAttemptPair(
        userId: string,
    ): Promise<{rows: number; correctStreak: number}>;
}

declare global {
    interface Window {
        __alConcurrencyProbe?: ConcurrencyProbeHandle;
    }
}

async function openProbe(page: Page): Promise<void> {
    await page.goto("/?e2e-hooks=1");
    await page.waitForFunction(() => !!window.__alConcurrencyProbe, null, {
        timeout: 15000,
    });
}

test.describe("Dexie concurrency against real IndexedDB (#2283)", () => {
    test("the three RMW pin mechanisms hold in real Chromium", async ({
        page,
    }, testInfo) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await openProbe(page);

        // Pair 1 - atomic increment (table.modify path): two concurrent
        // +10 awards must total 20. 10 = lost update, 0 = never wrote.
        const totalXp = await page.evaluate(() =>
            window.__alConcurrencyProbe!.persistXpPair("u-e2e-xp"),
        );
        expect(totalXp).toBe(20);

        // Pair 2 - transaction-wrapped full-replace merge: two concurrent
        // step_results must BOTH survive on the single progress row.
        const progress = await page.evaluate(() =>
            window.__alConcurrencyProbe!.lessonProgressPair("u-e2e-lp"),
        );
        expect(progress.stepIds).toEqual(["a", "b"]);
        expect(progress.scoreTotal).toBe(2);

        // Pair 3 - unique-index create race + accumulate: two concurrent
        // identical attempts yield ONE row with correct_streak 2.
        const attempts = await page.evaluate(() =>
            window.__alConcurrencyProbe!.elementAttemptPair("u-e2e-el"),
        );
        expect(attempts.rows).toBe(1);
        expect(attempts.correctStreak).toBe(2);

        testInfo.annotations.push({
            type: "measurement",
            description:
                "3 concurrent pairs fired through the app storage layer " +
                "against real IndexedDB (persistXP, upsertLessonProgress, " +
                "recordElementAttempts)",
        });
        expect(errors).toEqual([]);
    });
});
