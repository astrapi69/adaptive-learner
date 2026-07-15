/**
 * Lesson file import/export — device verification (#1672).
 *
 * Dexie build, NO backend, no AI key. Exercises the destructive-potential
 * and multi-step interactions that unit/modal tests cover but that warrant
 * a real-browser pass:
 *
 *   1. Round-trip: build a lesson in the creator, "Save as file"
 *      (captured download), then re-import that exact file → it lands in
 *      "My Lessons". Proves export → import works end-to-end on device.
 *   2. Name collision: re-importing the same file surfaces the
 *      overwrite / import-as-copy / cancel dialog (overwrite is
 *      irreversible), and BOTH the copy and the overwrite branches work.
 *   3. Partial set import: a ZIP fixture with one valid + one invalid
 *      lesson imports the valid one and shows the skipped report.
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors.
 */

import {join} from "node:path";

import {expect, test, type Page} from "@playwright/test";

const MIXED_ZIP = join(__dirname, "..", "fixtures", "mixed-set.zip");

const CARDS = [
    {front: "Bonjour", back: "Guten Tag"},
    {front: "Merci", back: "Danke"},
    {front: "Oui", back: "Ja"},
    {front: "Non", back: "Nein"},
];

/** Build + save a lesson through the 4-step creator; return on the
 *  post-save screen. */
async function buildAndSaveLesson(page: Page, title: string): Promise<void> {
    await page.goto("/create-lesson");
    await expect(page.getByTestId("create-lesson-page")).toBeVisible({
        timeout: 15000,
    });
    if (await page.getByTestId("create-lesson-draft-prompt").count()) {
        await page.getByTestId("create-lesson-draft-fresh").click();
    }
    await page.getByTestId("create-lesson-title").fill(title);
    await page.getByTestId("create-lesson-next").click();
    for (const card of CARDS) {
        await page.getByTestId("card-front-input").fill(card.front);
        await page.getByTestId("card-back-input").fill(card.back);
        await page.getByTestId("card-add-button").click();
    }
    await page.getByTestId("create-lesson-next").click();
    await expect(page.getByTestId("create-lesson-step-3")).toBeVisible();
    await page.getByTestId("exercise-count-slider").fill("8");
    await page.getByTestId("exercise-generate").click();
    await page.getByTestId("create-lesson-next").click();
    await expect(page.getByTestId("create-lesson-step-4")).toBeVisible({
        timeout: 10000,
    });
    await page.getByTestId("create-lesson-save-local").click();
    await expect(page.getByTestId("create-lesson-saved")).toBeVisible({
        timeout: 15000,
    });
}

/** Open the import modal (via the toolbar button on the currently-loaded
 *  Content Import tab) and upload a file. Does NOT navigate — the caller
 *  is already on the tab, so the in-memory set list (used for collision
 *  detection) stays warm, exactly as for a real user who just imported. */
async function openModalAndUpload(page: Page, filePath: string): Promise<void> {
    await page.getByTestId("content-import-lesson").click();
    await expect(page.getByTestId("import-lesson-modal")).toBeVisible();
    await page.getByTestId("import-lesson-file").setInputFiles(filePath);
    await expect(page.getByTestId("import-lesson-preview")).toBeVisible({
        timeout: 10000,
    });
}

/** Land on the Content Import tab and wait until the panel has loaded its
 *  set list (so collision detection reads a warm list). */
async function gotoImportTab(page: Page): Promise<void> {
    await page.goto("/content?tab=import");
    await expect(page.getByTestId("import-actions-panel")).toBeVisible({
        timeout: 15000,
    });
}

test.describe("Lesson file import/export (#1672)", () => {
    test("round-trip: save-as-file then re-import, with the collision dialog", async ({
        page,
    }, testInfo) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        // 1. Build + save, then export the lesson as a file (real download).
        await buildAndSaveLesson(page, "E2E Roundtrip");
        const [download] = await Promise.all([
            page.waitForEvent("download"),
            page.getByTestId("create-lesson-save-file").click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/\.json$/);
        const savedPath = join(
            testInfo.outputDir,
            download.suggestedFilename(),
        );
        await download.saveAs(savedPath);

        // 2. First import — no collision, lands in My Lessons.
        await gotoImportTab(page);
        await openModalAndUpload(page, savedPath);
        await expect(page.getByTestId("import-lesson-collision")).toHaveCount(0);
        await page.getByTestId("import-lesson-confirm").click();
        await expect(page.getByTestId("import-lesson-modal")).toHaveCount(0, {
            timeout: 15000,
        });
        await expect(
            page.locator('[data-testid^="my-lesson-"]').first(),
        ).toBeVisible({timeout: 15000});
        const afterFirst = await page
            .locator('[data-testid^="my-lesson-"]')
            .count();

        // 3. Re-import the SAME file (same page, warm set list) → collision
        //    dialog with three choices.
        await openModalAndUpload(page, savedPath);
        await page.getByTestId("import-lesson-confirm").click();
        await expect(page.getByTestId("import-lesson-collision")).toBeVisible({
            timeout: 10000,
        });
        await expect(page.getByTestId("import-lesson-overwrite")).toBeVisible();
        await expect(page.getByTestId("import-lesson-copy")).toBeVisible();
        await expect(page.getByTestId("import-lesson-cancel")).toBeVisible();

        // 3a. "Import as copy" → a NEW My-Lessons entry (no overwrite).
        await page.getByTestId("import-lesson-copy").click();
        await expect(page.getByTestId("import-lesson-modal")).toHaveCount(0, {
            timeout: 15000,
        });
        await expect
            .poll(
                async () =>
                    page.locator('[data-testid^="my-lesson-"]').count(),
                {timeout: 15000},
            )
            .toBeGreaterThan(afterFirst);
        const afterCopy = await page
            .locator('[data-testid^="my-lesson-"]')
            .count();

        // 3b. Re-import again → collision → "Overwrite" (irreversible) →
        //     succeeds and does NOT add another entry.
        await openModalAndUpload(page, savedPath);
        await page.getByTestId("import-lesson-confirm").click();
        await expect(page.getByTestId("import-lesson-collision")).toBeVisible({
            timeout: 10000,
        });
        await page.getByTestId("import-lesson-overwrite").click();
        await expect(page.getByTestId("import-lesson-modal")).toHaveCount(0, {
            timeout: 15000,
        });
        await expect(
            page.locator('[data-testid^="my-lesson-"]'),
        ).toHaveCount(afterCopy, {timeout: 15000});

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("partial set import: valid lessons import, invalid ones are reported", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await gotoImportTab(page);
        await openModalAndUpload(page, MIXED_ZIP);
        // The valid lesson previews; the skipped-report announces the invalid one.
        await expect(page.getByTestId("import-lesson-skipped")).toBeVisible();
        await page.getByTestId("import-lesson-confirm").click();
        await expect(page.getByTestId("import-lesson-modal")).toHaveCount(0, {
            timeout: 15000,
        });
        await expect(
            page.locator('[data-testid^="my-lesson-"]').first(),
        ).toBeVisible({timeout: 15000});

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
