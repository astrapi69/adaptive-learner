/**
 * Error Replay ("Fehler wiederholen") — v1.55.0 feature (E2E hardening).
 *
 * Dexie build, NO backend. Plays a real bundled lesson while answering
 * WRONG on purpose, so the lesson records element errors and lands on a
 * low (0-1 star) summary. The summary's single mistakes section
 * (``CorrectionBlock``, #2496) lands collapsed; expanding it exposes the
 * "Redo all exercises" full-replay CTA, which opens the Error Replay
 * lesson (only the failed exercises) that we walk to its summary.
 *
 * STABLE SELECTORS ONLY (Phase-B-proof): the correction-section and
 * ErrorReplayLesson ``data-testid`` anchors, plus the two-phase
 * check/next lesson buttons. No CSS-class or DOM-structure assertions.
 */

import {expect, test, type Page} from "@playwright/test";

import {createTestUser} from "../helpers/onboarding";
import {currentStepTestId, waitForStepAdvance} from "./_step-flow";

const SET_ID = "fr-a1-from-en";

/** Answer the on-screen exercise INCORRECTLY where we can force it
 *  (free-text + matching guarantee errors); other types take any
 *  answer. The goal is a low score with recorded element errors. */
async function answerWrong(page: Page): Promise<void> {
    if (await page.getByTestId("free-text-exercise").count()) {
        await page.getByTestId("free-text-input").fill("zzzzz");
        return;
    }
    if (await page.getByTestId("cloze-exercise").count()) {
        const inputs = page.locator('[data-testid^="cloze-input-"]');
        const n = await inputs.count();
        for (let i = 0; i < n; i++) await inputs.nth(i).fill("zzzzz");
        return;
    }
    if (await page.getByTestId("word-tiles-exercise").count()) {
        const scrambled = page.locator('[data-testid^="word-tile-scrambled-"]');
        let guard = 0;
        while ((await scrambled.count()) > 0 && guard++ < 12) {
            await scrambled.first().click();
        }
        return;
    }
    if (await page.getByTestId("picture-exercise").count()) {
        await page.locator('[data-testid^="picture-choice-"]').first().click();
        return;
    }
    if (await page.getByTestId("matching-exercise").count()) {
        // Deliberately mismatch: pair left i with right (i+1)%n.
        const lefts = page.getByTestId(/^matching-left-\d+$/);
        const n = await lefts.count();
        for (let i = 0; i < n; i++) {
            await page.getByTestId(`matching-left-${i}`).click();
            await page.getByTestId(`matching-right-${(i + 1) % n}`).click();
        }
        return;
    }
}

/** Advance one lesson step (grade via the shared Check button when the
 *  step is an exercise, then Next). */
async function advance(page: Page): Promise<void> {
    const check = page.getByTestId("lesson-check");
    if (await check.count()) {
        await expect(check).toBeEnabled({timeout: 5000});
        await check.click();
    }
    const next = page.getByTestId("lesson-next");
    await expect(next).toBeVisible({timeout: 5000});
    const beforeStep = await currentStepTestId(page);
    await next.click();
    await waitForStepAdvance(page, beforeStep);
}

async function downloadAndOpen(page: Page): Promise<void> {
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({timeout: 15000});
    await page.getByTestId("content-other-toggle").click();
    await page.getByTestId(`content-set-${SET_ID}-action`).click();
    const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(openBtn).toBeVisible({timeout: 20000});
    await openBtn.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 15000});
}

test.describe("Error Replay — retry only failed exercises", () => {
    test("wrong answers -> error-replay card -> replay lesson -> summary", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        // A learner is required: element errors (which drive the
        // error-replay suggestion) are recorded per user.
        await createTestUser(page);
        await downloadAndOpen(page);

        // Walk the lesson answering wrong to accrue element errors.
        for (let i = 0; i < 40; i++) {
            if (await page.getByTestId("lesson-summary").count()) break;
            await answerWrong(page);
            await advance(page);
        }
        await expect(page.getByTestId("lesson-summary")).toBeVisible({
            timeout: 15000,
        });

        // The mistakes section (#2496) lands collapsed; expanding it exposes
        // the full-replay CTA that opens the Error Replay lesson.
        const mistakes = page.getByTestId("lesson-correction-block");
        await expect(mistakes).toBeVisible({timeout: 10000});
        await page.getByTestId("lesson-correction-block-expand").click();
        const replayCta = page.getByTestId("lesson-correction-replay");
        await expect(replayCta).toBeVisible();
        await replayCta.click();

        // The Error Replay lesson renders (only the failed exercises).
        await expect(page.getByTestId("error-replay-page")).toBeVisible({
            timeout: 15000,
        });

        // Walk the replay to its summary (coverage-agnostic — any answer).
        for (let i = 0; i < 40; i++) {
            if (await page.getByTestId("error-replay-summary").count()) break;
            await answerWrong(page);
            const check = page.getByTestId("error-replay-check");
            if (await check.count()) {
                await expect(check).toBeEnabled({timeout: 5000});
                await check.click();
            }
            const next = page.getByTestId("error-replay-next");
            await expect(next).toBeVisible({timeout: 5000});
            const beforeStep = await currentStepTestId(page);
            await next.click();
            await waitForStepAdvance(page, beforeStep);
        }

        await expect(page.getByTestId("error-replay-summary")).toBeVisible({
            timeout: 15000,
        });
        await expect(page.getByTestId("error-replay-summary-score")).toBeVisible();

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
