/**
 * Legacy exercise-prompt migration on edit (#1860) — device verification.
 * Dexie build, NO backend, no AI key.
 *
 * The app no longer CREATES English-default prompts (#1857 localizes at
 * generation), so a genuine legacy lesson is produced through pure UI:
 * build + save a lesson under the ENGLISH UI (generation then emits the
 * exact old ``DEFAULT_EXERCISE_PROMPTS`` values), then switch the UI to
 * GERMAN and open it in the edit path (#1740). That must:
 *   1. migrate the exact-default prompts to German + show the notice,
 *   2. NOT persist without an explicit save (re-open still shows the notice),
 *   3. persist on save (re-open no longer shows the notice).
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors.
 */

import {expect, test, type Page} from "@playwright/test";

// created-<slug> under the user-generated source (draftSetId + USER_GENERATED_SOURCE).
const EDIT_URL = "/create-lesson/edit/user-generated/created-e2e-legacy-en";

const CARDS = [
    {front: "Bonjour", back: "Guten Tag"},
    {front: "Merci", back: "Danke"},
    {front: "Oui", back: "Ja"},
    {front: "Non", back: "Nein"},
];

async function setLanguage(page: Page, lang: string): Promise<void> {
    await page.evaluate(
        (l) => localStorage.setItem("adaptive-learner.language", l),
        lang,
    );
}

async function dismissDraftIfAny(page: Page): Promise<void> {
    if (await page.getByTestId("create-lesson-draft-prompt").count()) {
        await page.getByTestId("create-lesson-draft-fresh").click();
    }
}

test.describe("Legacy prompt migration on edit (#1860)", () => {
    test("migrates on edit-load, persists only on save", async ({page}) => {
        // Heavy flow: build+save under English, then three edit-loads + a
        // save under German. Well over the 30s default.
        test.setTimeout(90_000);
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        // Switch the UI to English so generation emits the exact old defaults.
        await page.goto("/");
        await setLanguage(page, "en");

        // Build + save a lesson under English UI → English-default prompts.
        await page.goto("/create-lesson");
        await expect(page.getByTestId("create-lesson-page")).toBeVisible({
            timeout: 15000,
        });
        await dismissDraftIfAny(page);
        await page.getByTestId("create-lesson-title").fill("E2E Legacy EN");
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

        // Switch the UI to German for the edit pass.
        await setLanguage(page, "de");

        // 1. Open in edit mode → the migration notice appears (an exact old
        //    default was migrated to German).
        await page.goto(EDIT_URL);
        await expect(page.getByTestId("create-lesson-page")).toBeVisible({
            timeout: 15000,
        });
        await expect(
            page.getByTestId("create-lesson-prompts-migrated"),
        ).toBeVisible({timeout: 15000});

        // 2. No persist without save: re-open fresh → the notice appears AGAIN
        //    (storage still holds the English default).
        await page.goto(EDIT_URL);
        await expect(
            page.getByTestId("create-lesson-prompts-migrated"),
        ).toBeVisible({timeout: 15000});

        // 3. Save this pass, then re-open → the notice is GONE (persisted German).
        await page.getByTestId("create-lesson-next").click(); // → 2
        await page.getByTestId("create-lesson-next").click(); // → 3
        await page.getByTestId("create-lesson-next").click(); // → 4
        await expect(page.getByTestId("create-lesson-step-4")).toBeVisible({
            timeout: 10000,
        });
        await page.getByTestId("create-lesson-save-local").click();
        await expect(page.getByTestId("create-lesson-saved")).toBeVisible({
            timeout: 15000,
        });

        await page.goto(EDIT_URL);
        // Wait until edit-load completes (the title field is pre-filled on
        // step 1) before asserting the notice is absent.
        await expect(
            page.getByTestId("create-lesson-title"),
        ).toHaveValue("E2E Legacy EN", {timeout: 15000});
        await expect(
            page.getByTestId("create-lesson-prompts-migrated"),
        ).toHaveCount(0);

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
