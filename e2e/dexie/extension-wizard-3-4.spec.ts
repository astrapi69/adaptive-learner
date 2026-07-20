/**
 * Extension-authoring wizard editors 3+4 (#1852) — device verification.
 * Dexie build, NO backend, no AI key.
 *
 * Authors a reading-comprehension AND a graded-quiz exercise through the
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

/** Fill one multiple-choice sub-question (prompt + 2 options, first correct)
 *  in a reading-comprehension / graded-quiz editor. ``qPrefix`` is e.g.
 *  ``exercise-ext-rc-q-<id>`` or ``exercise-ext-gq-q-<id>``. */
async function fillMcQuestion(page: Page, qPrefix: string): Promise<void> {
    await page.getByTestId(`${qPrefix}-0-prompt`).fill("Where did Rex run?");
    await page.getByTestId(`${qPrefix}-0-opt-text-0`).fill("The garden");
    await page.getByTestId(`${qPrefix}-0-opt-text-1`).fill("The street");
    await page.getByTestId(`${qPrefix}-0-opt-correct-0`).check();
}

test.describe("Create-Lesson extension wizard editors 3+4 (#1852)", () => {
    test("authors reading-comprehension + graded-quiz and plays them", async ({
        page,
    }) => {
        test.setTimeout(90_000);
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await openFresh(page);
        await page.getByTestId("create-lesson-title").fill("E2E extensions 3+4");
        await page.getByTestId("template-extensions").click();
        await expect(
            page.getByTestId("create-lesson-extension-step"),
        ).toBeVisible();

        // --- Author a reading-comprehension exercise ---
        await page.getByTestId("extension-add").click();
        await page.getByTestId("extension-add-type-reading-comprehension").click();
        const rcId = await openEditorId(page);
        await page.getByTestId(`exercise-ext-prompt-${rcId}`).fill("Read + answer");
        await page
            .getByTestId(`exercise-ext-rc-passage-${rcId}`)
            .fill("Rex ran into the garden and barked at the postman.");
        await fillMcQuestion(page, `exercise-ext-rc-q-${rcId}`);
        await expect(page.getByTestId(`exercise-ext-save-${rcId}`)).toBeEnabled();
        await page.getByTestId(`exercise-ext-save-${rcId}`).click();

        // --- Author a graded-quiz exercise ---
        await page.getByTestId("extension-add").click();
        await page.getByTestId("extension-add-type-graded-quiz").click();
        const gqId = await openEditorId(page);
        await page.getByTestId(`exercise-ext-prompt-${gqId}`).fill("Take the quiz");
        // threshold defaults to 60, points default to 1 (both valid).
        await fillMcQuestion(page, `exercise-ext-gq-q-${gqId}`);
        await expect(page.getByTestId(`exercise-ext-save-${gqId}`)).toBeEnabled();
        await page.getByTestId(`exercise-ext-save-${gqId}`).click();

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

        let sawReading = false;
        let sawGraded = false;
        for (let i = 0; i < 30; i++) {
            if (await page.getByTestId("lesson-summary").count()) break;

            if (await page.getByTestId("reading-comprehension-exercise").count()) {
                sawReading = true;
                // Answer the single MC question (first option).
                await page
                    .getByTestId("reading-comprehension-question-0")
                    .locator("button")
                    .first()
                    .click();
            } else if (await page.getByTestId("graded-quiz-exercise").count()) {
                sawGraded = true;
                await page
                    .getByTestId("graded-quiz-question-0")
                    .locator('input[type="checkbox"]')
                    .first()
                    .check();
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

        expect(sawReading, "reading-comprehension exercise should render").toBe(
            true,
        );
        expect(sawGraded, "graded-quiz exercise should render").toBe(true);
        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
