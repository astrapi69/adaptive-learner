/**
 * Lesson Creator (/create-lesson) — full build flow (E2E hardening).
 *
 * Dexie build, NO backend, no AI key (the exercise generator is the
 * deterministic offline module). Walks the 4-step wizard:
 *   1. Metadata (title; the language pair defaults to source != target)
 *   2. Card editor (add 4 cards — MIN_CARDS)
 *   3. Exercise generator (auto-generate >= 5 — MIN_EXERCISES)
 *   4. Save locally -> the lesson appears under "My Lessons" on /content.
 *
 * STABLE SELECTORS ONLY (Phase-B-proof): ``data-testid`` anchors,
 * step-indicator testids, and the /content route. No CSS-class or
 * DOM-structure assertions.
 */

import {expect, test, type Page} from "@playwright/test";

const CARDS = [
    {front: "Bonjour", back: "Guten Tag"},
    {front: "Merci", back: "Danke"},
    {front: "Oui", back: "Ja"},
    {front: "Non", back: "Nein"},
];

/** Fill step-1 metadata and advance. The language pair defaults to
 *  source != target, so only the title is required. */
async function fillMetadata(page: Page): Promise<void> {
    await page.getByTestId("create-lesson-title").fill("E2E Greetings");
    // The same-language error must NOT be showing (defaults differ).
    await expect(page.getByTestId("create-lesson-same-language-error")).toHaveCount(
        0,
    );
    await page.getByTestId("create-lesson-next").click();
}

/** Add the four cards in the editor. */
async function addCards(page: Page): Promise<void> {
    for (const card of CARDS) {
        await page.getByTestId("card-front-input").fill(card.front);
        await page.getByTestId("card-back-input").fill(card.back);
        await page.getByTestId("card-add-button").click();
    }
    await page.getByTestId("create-lesson-next").click();
}

/** Generate exercises (bump the count slider so we comfortably clear
 *  MIN_EXERCISES) and advance. */
async function generateExercises(page: Page): Promise<void> {
    await expect(page.getByTestId("create-lesson-step-3")).toBeVisible();
    // Range input: set a healthy target before generating.
    await page.getByTestId("exercise-count-slider").fill("8");
    await page.getByTestId("exercise-generate").click();
    await page.getByTestId("create-lesson-next").click();
    // If generation under-produced, the wizard would block on step 3
    // with create-lesson-exercise-error; reaching step 4 proves >= 5.
}

test.describe("Lesson Creator — build + save a lesson", () => {
    test("metadata -> 4 cards -> generate -> save -> appears in My Lessons", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto("/create-lesson");
        await expect(page.getByTestId("create-lesson-page")).toBeVisible({
            timeout: 15000,
        });
        // A restorable draft would prompt continue-or-fresh; on a clean
        // browser it won't, but be defensive.
        if (await page.getByTestId("create-lesson-draft-prompt").count()) {
            await page.getByTestId("create-lesson-draft-fresh").click();
        }

        await fillMetadata(page);
        await addCards(page);
        await generateExercises(page);

        // Step 4 — save locally.
        await expect(page.getByTestId("create-lesson-step-4")).toBeVisible({
            timeout: 10000,
        });
        await page.getByTestId("create-lesson-save-local").click();
        await expect(page.getByTestId("create-lesson-saved")).toBeVisible({
            timeout: 15000,
        });

        // Jump to the Content Browser and confirm the lesson is accessible.
        // #543 — it lands in "My Lessons" or, if it matches a published set,
        // folds into that tree node (EXP-026); accept either location.
        await page.getByTestId("create-lesson-to-browser").click();
        await expect(
            page
                .locator(
                    '[data-testid^="my-lesson-"], [data-testid^="folded-lesson-"]',
                )
                .first(),
        ).toBeVisible({timeout: 15000});

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("creator renders at 375px (mobile)", async ({page}) => {
        await page.setViewportSize({width: 375, height: 720});
        await page.goto("/create-lesson");
        await expect(page.getByTestId("create-lesson-page")).toBeVisible({
            timeout: 15000,
        });
        if (await page.getByTestId("create-lesson-draft-prompt").count()) {
            await page.getByTestId("create-lesson-draft-fresh").click();
        }
        await expect(
            page.getByTestId("create-lesson-step-indicator"),
        ).toBeVisible();
        await expect(page.getByTestId("create-lesson-title")).toBeVisible();
    });
});
