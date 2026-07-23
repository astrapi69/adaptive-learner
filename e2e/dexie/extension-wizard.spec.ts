/**
 * Extension-authoring wizard (#1852, editors 1+2) — device verification.
 * Dexie build, NO backend, no AI key.
 *
 * Authors a categorization AND an error-correction exercise through the
 * dedicated extension wizard branch, saves the set locally, and plays it in
 * the real Dexie lesson player — proving both adopted extension types round-
 * trip end to end (authoring -> requires_extensions -> renderer) with no page
 * error.
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors.
 */

import {expect, test, type Page} from "@playwright/test";

async function openFresh(page: Page): Promise<void> {
    await page.goto("/create-lesson");
    await expect(page.getByTestId("create-lesson-page")).toBeVisible({
        timeout: 15000,
    });
    if (await page.getByTestId("create-lesson-draft-prompt").count()) {
        await page.getByTestId("create-lesson-draft-fresh").click();
    }
}

/** The id of the currently-open inline extension editor (``ex-ext-N``). */
async function openEditorId(page: Page): Promise<string> {
    const editor = page.locator('[data-testid^="exercise-ext-editor-"]');
    await expect(editor).toBeVisible();
    const testid = await editor.getAttribute("data-testid");
    return testid!.replace("exercise-ext-editor-", "");
}

test.describe("Create-Lesson extension wizard (#1852)", () => {
    test("authors categorization + error-correction and plays them", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await openFresh(page);
        await page.getByTestId("create-lesson-title").fill("E2E extensions");

        // Enter the extension path from the step-1 template card.
        await page.getByTestId("template-extensions").click();
        await expect(
            page.getByTestId("create-lesson-extension-step"),
        ).toBeVisible();

        // --- Author a categorization exercise ---
        await page.getByTestId("extension-add").click();
        await page.getByTestId("extension-add-type-categorization").click();
        const catId = await openEditorId(page);
        await page
            .getByTestId(`exercise-ext-prompt-${catId}`)
            .fill("Sort each signal");
        await page.getByTestId(`exercise-ext-cat-name-${catId}-0`).fill("Sight");
        await page.getByTestId(`exercise-ext-cat-name-${catId}-1`).fill("Sound");
        await page
            .getByTestId(`exercise-ext-cat-items-${catId}-0-input`)
            .fill("flat hand");
        await page.getByTestId(`exercise-ext-cat-items-${catId}-0-add`).click();
        await page
            .getByTestId(`exercise-ext-cat-items-${catId}-1-input`)
            .fill("Sit");
        await page.getByTestId(`exercise-ext-cat-items-${catId}-1-add`).click();
        await expect(
            page.getByTestId(`exercise-ext-save-${catId}`),
        ).toBeEnabled();
        await page.getByTestId(`exercise-ext-save-${catId}`).click();

        // --- Author an error-correction exercise ---
        await page.getByTestId("extension-add").click();
        await page.getByTestId("extension-add-type-error-correction").click();
        const ecId = await openEditorId(page);
        await page
            .getByTestId(`exercise-ext-prompt-${ecId}`)
            .fill("Fix the wrong word");
        await page
            .getByTestId(`exercise-ext-token-input-${ecId}-0`)
            .fill("dog");
        await page
            .getByTestId(`exercise-ext-token-input-${ecId}-1`)
            .fill("follow");
        // Mark the second word as the error.
        await page.getByTestId(`exercise-ext-token-error-${ecId}-1`).click();
        await page
            .getByTestId(`exercise-ext-accept-${ecId}-input`)
            .fill("follows");
        await page.getByTestId(`exercise-ext-accept-${ecId}-add`).click();
        await expect(page.getByTestId(`exercise-ext-save-${ecId}`)).toBeEnabled();
        await page.getByTestId(`exercise-ext-save-${ecId}`).click();

        // --- Review + save locally ---
        await page.getByTestId("create-lesson-next").click();
        await expect(
            page.getByTestId("create-lesson-extension-review"),
        ).toBeVisible();
        await expect(page.getByTestId("extension-review-count")).toHaveText("2");
        await page.getByTestId("create-lesson-save-local").click();
        await expect(page.getByTestId("create-lesson-saved")).toBeVisible({
            timeout: 15000,
        });

        // --- Play the saved extension lesson ---
        await page.getByTestId("create-lesson-play").click();
        await expect(page.getByTestId("lesson-page")).toBeVisible({
            timeout: 15000,
        });

        let sawCategorization = false;
        let sawErrorCorrection = false;
        for (let i = 0; i < 30; i++) {
            if (await page.getByTestId("lesson-summary").count()) break;

            if (await page.getByTestId("categorization-exercise").count()) {
                sawCategorization = true;
                const pool = page
                    .getByTestId("categorization-pool")
                    .locator("button");
                // Assign every pooled chip to the first bucket.
                for (let guard = 0; guard < 20; guard++) {
                    if ((await pool.count()) === 0) break;
                    await pool.first().click();
                    await page
                        .locator(
                            '[data-testid^="categorization-bucket-assign-"]',
                        )
                        .first()
                        .click();
                }
            } else if (await page.getByTestId("error-correction-exercise").count()) {
                sawErrorCorrection = true;
                await page.getByTestId("error-correction-token-1").click();
                await page.getByTestId("error-correction-input").fill("follows");
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

        expect(sawCategorization, "categorization exercise should render").toBe(
            true,
        );
        expect(
            sawErrorCorrection,
            "error-correction exercise should render",
        ).toBe(true);
        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
