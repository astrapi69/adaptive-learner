/**
 * Step-3 manual add (#1849) + multiple_choice type (#1850) — device
 * verification. Dexie build, NO backend, no AI key.
 *
 * Covers: multiple_choice generates from cards, is editable inline, and
 * plays in the finished lesson; a manually-added exercise opens straight in
 * the inline editor and, left incomplete, blocks the wizard from reaching
 * step 4 (same per-type validation as generated exercises).
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors.
 */

import {expect, test, type Page} from "@playwright/test";

// Distinct backs so multiple_choice can build distractor options.
const CARDS = [
    {front: "chat", back: "Katze"},
    {front: "chien", back: "Hund"},
    {front: "oiseau", back: "Vogel"},
    {front: "poisson", back: "Fisch"},
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
    await page.getByTestId("create-lesson-title").fill("E2E MC + manual");
    await page.getByTestId("create-lesson-next").click();
    for (const card of CARDS) {
        await page.getByTestId("card-front-input").fill(card.front);
        await page.getByTestId("card-back-input").fill(card.back);
        await page.getByTestId("card-add-button").click();
    }
    await page.getByTestId("create-lesson-next").click();
    await expect(page.getByTestId("create-lesson-step-3")).toBeVisible();
    await page.getByTestId("exercise-generate").click();
    await expect(page.getByTestId("exercise-list")).toBeVisible();
}

test.describe("Create-Lesson MC + manual add (#1849/#1850)", () => {
    test("multiple_choice generates, is editable, and plays", async ({page}) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await openFresh(page);
        await buildAndGenerate(page);

        // A multiple_choice exercise was generated.
        const mcRow = page
            .locator('[data-testid^="exercise-row-"][data-type="multiple_choice"]')
            .first();
        await expect(mcRow).toBeVisible();

        // Its inline editor opens with the MC-specific fields.
        await mcRow.locator('[data-testid^="exercise-edit-"]').first().click();
        await expect(
            mcRow.locator('[data-testid^="exercise-edit-mc-text-"]').first(),
        ).toBeVisible();
        await mcRow.locator('[data-testid^="exercise-edit-cancel-"]').click();

        // Save + play; assert a multiple_choice step renders and is answerable.
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

        let sawMc = false;
        for (let i = 0; i < 40; i++) {
            if (await page.getByTestId("lesson-summary").count()) break;
            if (await page.getByTestId("multiple-choice-exercise").count()) {
                sawMc = true;
                await page.getByTestId("multiple-choice-input-0").click();
            } else if (await page.getByTestId("free-text-input").count()) {
                await page.getByTestId("free-text-input").first().fill("x");
            } else if (await page.getByTestId("matching-exercise").count()) {
                const n = await page.getByTestId(/^matching-left-\d+$/).count();
                for (let k = 0; k < n; k++) {
                    await page.getByTestId(`matching-left-${k}`).click();
                    await page.getByTestId(`matching-right-${k}`).click();
                }
            } else if (await page.getByTestId("picture-exercise").count()) {
                await page.locator('[data-testid^="picture-choice-"]').first().click();
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
        expect(sawMc, "a multiple-choice exercise should render").toBe(true);
        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("manual add opens the editor; incomplete blocks step 4", async ({
        page,
    }) => {
        await openFresh(page);
        await buildAndGenerate(page);

        // Add a manual matching exercise -> the picker -> the inline editor.
        await page.getByTestId("exercise-add").click();
        await expect(page.getByTestId("exercise-add-picker")).toBeVisible();
        await page.getByTestId("exercise-add-type-matching").click();

        // A new row opened straight in edit mode with matching fields.
        const editor = page.locator('[data-testid^="exercise-editor-"]').first();
        await expect(editor).toBeVisible();
        await expect(
            editor.locator('[data-testid^="exercise-edit-pair-left-"]').first(),
        ).toBeVisible();
        // Save is disabled while empty (no silent invalid save).
        await expect(
            editor.locator('[data-testid^="exercise-edit-save-"]'),
        ).toBeDisabled();
        // Cancel leaves the (still-empty) manual exercise in the list.
        await editor.locator('[data-testid^="exercise-edit-cancel-"]').click();

        // Next is blocked: the incomplete manual exercise fails validation.
        await page.getByTestId("create-lesson-next").click();
        await expect(page.getByTestId("create-lesson-exercise-error")).toBeVisible();
        await expect(page.getByTestId("create-lesson-step-3")).toBeVisible();

        // Delete the incomplete manual row -> advancing works again.
        const manualRow = page
            .locator('[data-testid^="exercise-row-ex-manual-"]')
            .first();
        await manualRow.locator('[data-testid^="exercise-delete-"]').click();
        await page.getByTestId("create-lesson-next").click();
        await expect(page.getByTestId("create-lesson-step-4")).toBeVisible({
            timeout: 10000,
        });
    });
});
