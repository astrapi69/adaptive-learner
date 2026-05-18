/**
 * Phase 6D smoke: Landing page loads, language picker is
 * present, Start button routes to /onboarding.
 *
 * This is the cheapest possible end-to-end check: it verifies
 * the dev server is up, the React shell mounts, and the
 * fundamental client-side routing works.
 */

import {expect, test} from "@playwright/test";

test.describe("Landing", () => {
    test("renders the brand, language picker, and Start button", async ({page}) => {
        await page.goto("/");
        await expect(page.getByTestId("landing")).toBeVisible();
        await expect(page.getByTestId("landing-start")).toBeVisible();
        // The five v0.2.0 supported languages each get a button.
        for (const code of ["de", "en", "es", "fr", "el"]) {
            await expect(page.getByTestId(`landing-lang-${code}`)).toBeVisible();
        }
    });

    test("clicking Start navigates to /onboarding", async ({page}) => {
        await page.goto("/");
        await page.getByTestId("landing-start").click();
        await expect(page.getByTestId("onboarding")).toBeVisible();
        expect(page.url()).toContain("/onboarding");
    });

    test("clicking a language button updates the active state", async ({page}) => {
        await page.goto("/");
        // Default is DE; switch to EN.
        await page.getByTestId("landing-lang-en").click();
        await expect(page.getByTestId("landing-lang-en")).toHaveAttribute(
            "aria-checked",
            "true",
        );
        await expect(page.getByTestId("landing-lang-de")).toHaveAttribute(
            "aria-checked",
            "false",
        );
    });
});
