/**
 * Toasts during a run sit ABOVE the run footer on phones (#3235).
 *
 * Dexie build, NO backend, no AI key, 375x812. A toast that fires during a
 * run used to lie full-width over the bottom edge, exactly where the run
 * footer (Check / Next) sits, and an error toast stays until closed. The
 * container now moves above the footer on the runner routes and a tap
 * closes a toast. Content-independent: builds + saves a lesson through the
 * Create-Lesson wizard and plays it; the toast is the real "Game mode is
 * on" success toast of the playful-mode hint, the one blocking toast a
 * fresh install can raise inside a run without an error.
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors plus the library's
 * container class (its geometry is the subject).
 */

import {expect, test, type Page} from "@playwright/test";

import {declineDraftPrompt} from "../helpers";

import {completeOnboarding} from "../helpers/onboarding";

test.use({viewport: {width: 375, height: 812}});

const CARDS = [
    {front: "Bonjour", back: "Guten Tag"},
    {front: "Merci", back: "Danke"},
    {front: "Oui", back: "Ja"},
    {front: "Non", back: "Nein"},
];

async function buildSaveAndPlay(page: Page): Promise<void> {
    await completeOnboarding(page, {migrationOffer: "none"});
    await page.goto("/create-lesson");
    await expect(page.getByTestId("create-lesson-page")).toBeVisible({timeout: 15000});
    await declineDraftPrompt(page);
    await page.getByTestId("create-lesson-title").fill("E2E Toast Footer");
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
    await expect(page.getByTestId("create-lesson-step-4")).toBeVisible({timeout: 10000});
    await page.getByTestId("create-lesson-save-local").click();
    await expect(page.getByTestId("create-lesson-saved")).toBeVisible({timeout: 15000});
    await page.getByTestId("create-lesson-play").click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 15000});
}

test.describe("#3235 - toasts above the run footer on phones", () => {
    test("a toast raised during a run does not cover the footer, and a tap closes it", async ({
        page,
    }) => {
        await buildSaveAndPlay(page);
        const footer = page.getByTestId("lesson-footer").first();
        await expect(footer).toBeVisible();
        const footerBox = (await footer.boundingBox())!;
        console.log(`run footer at 375px: ${JSON.stringify(footerBox)}`);

        // The one blocking toast a fresh install raises inside a run.
        await page.getByTestId("lesson-playful-hint-activate").click();
        const toast = page.locator(".Toastify__toast--success").first();
        await expect(toast).toBeVisible();
        const container = page.locator(".Toastify__toast-container").first();
        await expect(container).toHaveClass(/toast-container-above-run-footer/);
        const toastBox = (await toast.boundingBox())!;
        console.log(`toast at 375px: ${JSON.stringify(toastBox)}`);
        expect(
            toastBox.y + toastBox.height,
            "the toast's bottom edge must stay above the footer's top edge",
        ).toBeLessThanOrEqual(footerBox.y + 1);

        // A tap anywhere on the toast closes it (not only its X). The
        // container's closeOnClick reached this toast (the library marks
        // it), and the tap waits for the slide-in to end.
        await expect(toast).toHaveClass(/Toastify__toast--close-on-click/);
        await expect(toast).not.toHaveClass(/enter/);
        const settled = (await toast.boundingBox())!;
        console.log(`toast settled at 375px: ${JSON.stringify(settled)}`);
        await page.mouse.click(settled.x + 24, settled.y + settled.height / 2);
        await expect(toast).toHaveCount(0, {timeout: 10_000});
    });

    test("outside a run the container keeps its app-wide shape", async ({page}) => {
        await completeOnboarding(page, {migrationOffer: "none"});
        await page.goto("/dashboard");
        await expect(page.getByTestId("dashboard")).toBeVisible({timeout: 15000});
        const lifted = await page.locator(".toast-container-above-run-footer").count();
        expect(lifted).toBe(0);
    });
});
