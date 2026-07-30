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
    // The landing page only renders on an EMPTY install: since the
    // identity-recovery feature (97d72fac, 2026-05-23) "/" finds the
    // most recent backend user and redirects to the dashboard. The
    // suite shares one serial backend, so earlier specs' users made
    // these tests impossible in sequence (#2170). The shipped Danger-
    // Zone reset endpoint restores the empty install product-faithfully.
    test.beforeEach(async ({page}) => {
        const resp = await page.request.post("/api/reset", {
            data: {confirmation: "RESET"},
        });
        if (!resp.ok()) {
            throw new Error(`landing reset failed: ${resp.status()}`);
        }
    });

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
