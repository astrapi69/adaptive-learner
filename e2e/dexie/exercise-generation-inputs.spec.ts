/**
 * Create-Lesson generation inputs — device verification (#1847).
 *
 * Dexie build, NO backend, no AI key. Proves that the explicit
 * per-card **Example sentence** field drives cloze + word-tiles generation
 * (previously only reachable by overloading the notes field), and that a
 * SELECTED type which produced nothing is explained instead of silently
 * dropped (picture-choice with no card images → an inline hint).
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors.
 */

import {expect, test, type Page} from "@playwright/test";

// 2 cards carry an example sentence containing the front term (so cloze can
// blank it) with >= 2 words (so word-tiles can split it); 2 do not.
const CARDS = [
    {front: "chat", back: "Katze", example: "Le chat dort ici."},
    {front: "chien", back: "Hund", example: "Le chien court vite."},
    {front: "oiseau", back: "Vogel", example: ""},
    {front: "poisson", back: "Fisch", example: ""},
];

async function openFresh(page: Page): Promise<void> {
    await page.goto("/create-lesson");
    await expect(page.getByTestId("create-lesson-page")).toBeVisible({
        timeout: 15000,
    });
    if (await page.getByTestId("create-lesson-draft-prompt").count()) {
        await page.getByTestId("create-lesson-draft-fresh").click();
    }
}

async function buildAndGenerate(page: Page): Promise<void> {
    await page.getByTestId("create-lesson-title").fill("E2E Example Inputs");
    await page.getByTestId("create-lesson-next").click();
    for (const card of CARDS) {
        await page.getByTestId("card-front-input").fill(card.front);
        await page.getByTestId("card-back-input").fill(card.back);
        if (card.example) {
            await page.getByTestId("card-example-input").fill(card.example);
        }
        await page.getByTestId("card-add-button").click();
    }
    await page.getByTestId("create-lesson-next").click();
    await expect(page.getByTestId("create-lesson-step-3")).toBeVisible();
    // Default config selects all five types.
    await page.getByTestId("exercise-generate").click();
    await expect(page.getByTestId("exercise-list")).toBeVisible();
}

test.describe("Create-Lesson generation inputs (#1847)", () => {
    test("example sentences drive cloze + word_tiles; missing images explained", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await openFresh(page);
        await buildAndGenerate(page);

        // The explicit example field produced cloze + word-tiles exercises.
        await expect(
            page
                .locator('[data-testid^="exercise-row-"][data-type="cloze"]')
                .first(),
        ).toBeVisible();
        await expect(
            page
                .locator('[data-testid^="exercise-row-"][data-type="word_tiles"]')
                .first(),
        ).toBeVisible();

        // picture_choice was selected but no card has an image → explained,
        // not silently dropped.
        await expect(
            page.getByTestId("exercise-gen-missing-picture_choice"),
        ).toBeVisible();

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("the generated cloze plays in the lesson", async ({page}) => {
        await openFresh(page);
        await buildAndGenerate(page);

        await page.getByTestId("create-lesson-next").click();
        await expect(page.getByTestId("create-lesson-step-4")).toBeVisible({
            timeout: 10000,
        });
        await page.getByTestId("create-lesson-save-local").click();
        await expect(page.getByTestId("create-lesson-saved")).toBeVisible({
            timeout: 15000,
        });
        await page.getByTestId("create-lesson-play").click();
        await expect(page.getByTestId("lesson-page")).toBeVisible({
            timeout: 15000,
        });

        // Walk the lesson; assert a cloze exercise renders at some step.
        let sawCloze = false;
        for (let i = 0; i < 40; i++) {
            if (await page.getByTestId("lesson-summary").count()) break;
            if (await page.getByTestId("cloze-exercise").count()) {
                sawCloze = true;
                break;
            }
            // Answer minimally to advance past whatever is on screen.
            if (await page.getByTestId("free-text-input").count()) {
                await page.getByTestId("free-text-input").first().fill("x");
            } else if (await page.getByTestId("matching-exercise").count()) {
                const lefts = page.getByTestId(/^matching-left-\d+$/);
                const n = await lefts.count();
                for (let k = 0; k < n; k++) {
                    await page.getByTestId(`matching-left-${k}`).click();
                    await page.getByTestId(`matching-right-${k}`).click();
                }
            } else if (await page.getByTestId("word-tiles-exercise").count()) {
                const tiles = page.locator(
                    '[data-testid^="word-tile-scrambled-"]',
                );
                let guard = 0;
                while ((await tiles.count()) > 0 && guard++ < 12) {
                    await tiles.first().click();
                }
            }
            const check = page.getByTestId("lesson-check");
            if (await check.count()) {
                await expect(check).toBeEnabled({timeout: 5000});
                await check.click();
            }
            const next = page.getByTestId("lesson-next");
            if (!(await next.count())) break;
            await next.click();
        }

        expect(sawCloze, "a cloze exercise should render in the player").toBe(
            true,
        );
    });
});
