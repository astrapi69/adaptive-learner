/**
 * Lesson summary shows exactly ONE favorite button (#1649).
 *
 * Dexie build, NO backend, no AI key. A duplicate favorite control on the
 * end-of-lesson summary was removed in v2.3.0; this spec guards that only
 * a single favorite toggle renders there.
 *
 * Content-independent: it builds + saves a lesson through the Create-Lesson
 * wizard (the offline generator, no bundled content set required) and plays
 * it to the scored summary, then counts the favorite control. This keeps the
 * spec runnable without a content-repo checkout.
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors + the two-phase
 * check/next lesson buttons.
 */

import {expect, test, type Page} from "@playwright/test";

import {completeOnboarding} from "../helpers/onboarding";

const CARDS = [
    {front: "Bonjour", back: "Guten Tag"},
    {front: "Merci", back: "Danke"},
    {front: "Oui", back: "Ja"},
    {front: "Non", back: "Nein"},
];

/** Build + save a lesson via the wizard, then start playing it. Lands on
 *  the lesson page. */
async function buildSaveAndPlay(page: Page): Promise<void> {
    // The summary favorite control renders only for a signed-in learner
    // (SummaryFavorite returns null without a userId), so seed one first.
    await completeOnboarding(page);
    await page.goto("/create-lesson");
    await expect(page.getByTestId("create-lesson-page")).toBeVisible({
        timeout: 15000,
    });
    if (await page.getByTestId("create-lesson-draft-prompt").count()) {
        await page.getByTestId("create-lesson-draft-fresh").click();
    }
    await page.getByTestId("create-lesson-title").fill("E2E Favorite");
    await page.getByTestId("create-lesson-next").click();
    for (const card of CARDS) {
        await page.getByTestId("card-front-input").fill(card.front);
        await page.getByTestId("card-back-input").fill(card.back);
        await page.getByTestId("card-add-button").click();
    }
    await page.getByTestId("create-lesson-next").click();
    await expect(page.getByTestId("create-lesson-step-3")).toBeVisible();
    await page.getByTestId("exercise-generate").click();
    await page.getByTestId("create-lesson-next").click();
    await expect(page.getByTestId("create-lesson-step-4")).toBeVisible({
        timeout: 10000,
    });
    await page.getByTestId("create-lesson-save-local").click();
    await expect(page.getByTestId("create-lesson-saved")).toBeVisible({
        timeout: 15000,
    });
    await page.getByTestId("create-lesson-play").click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 15000});
}

/** Answer whatever exercise is on screen (any answer — the goal is to reach
 *  the summary, not a perfect score). */
async function answer(page: Page): Promise<void> {
    if (await page.getByTestId("free-text-input").count()) {
        await page.getByTestId("free-text-input").first().fill("x");
        return;
    }
    if (await page.getByTestId("cloze-exercise").count()) {
        const inputs = page.locator('[data-testid^="cloze-input-"]');
        const n = await inputs.count();
        for (let i = 0; i < n; i++) await inputs.nth(i).fill("x");
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
    if (await page.getByTestId("multiple-choice-exercise").count()) {
        await page.getByTestId("multiple-choice-input-0").click();
        return;
    }
    if (await page.getByTestId("picture-exercise").count()) {
        await page.locator('[data-testid^="picture-choice-"]').first().click();
        return;
    }
    if (await page.getByTestId("matching-exercise").count()) {
        const n = await page.getByTestId(/^matching-left-\d+$/).count();
        for (let i = 0; i < n; i++) {
            await page.getByTestId(`matching-left-${i}`).click();
            await page.getByTestId(`matching-right-${i}`).click();
        }
        return;
    }
}

test.describe("Lesson summary favorite control (#1649)", () => {
    test("summary renders exactly one favorite button", async ({page}) => {
        test.setTimeout(90_000);
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await buildSaveAndPlay(page);

        // Walk to the scored summary.
        for (let i = 0; i < 40; i++) {
            if (await page.getByTestId("lesson-summary").count()) break;
            await answer(page);
            const check = page.getByTestId("lesson-check");
            if (await check.count()) {
                await expect(check).toBeEnabled({timeout: 5000});
                await check.click();
            }
            const next = page.getByTestId("lesson-next");
            if (!(await next.count())) break;
            await next.click();
        }

        await expect(page.getByTestId("lesson-summary")).toBeVisible({
            timeout: 15000,
        });

        // #1649 — exactly one favorite control on the summary (the duplicate
        // was removed), inside the single favorite section.
        await expect(page.getByTestId("lesson-summary-favorite")).toHaveCount(1);
        await expect(page.getByTestId("lesson-favorite-toggle")).toHaveCount(1);

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
