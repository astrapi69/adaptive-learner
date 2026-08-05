/**
 * Static landing page (#2409, EXP-049 step 5).
 *
 * The landing page is real text in delivered HTML - the one public
 * surface that says what the product is without JavaScript assembling
 * it. These checks pin exactly that property: the page loads as a
 * static asset under /start/ (DE) and /start/en/ (EN), carries the
 * architect's core promise as its h1, and links back into the app.
 * No numbers are asserted on purpose - the page deliberately carries
 * none that could go stale (#2403 class).
 */

import {expect, test} from "@playwright/test";

test.describe("Static landing page", () => {
    test("German page delivers the promise as static text and links to the app", async ({
        page,
    }) => {
        await page.goto("/start/");
        await expect(page.getByTestId("landing-main")).toBeVisible();
        await expect(
            page.getByRole("heading", {
                name: "Eine App, die sich dir anpasst, nicht umgekehrt.",
            }),
        ).toBeVisible();
        await expect(page.getByTestId("landing-open-app")).toHaveAttribute(
            "href",
            "../",
        );
    });

    test("English page mirrors the promise and cross-links the German one", async ({
        page,
    }) => {
        await page.goto("/start/en/");
        await expect(
            page.getByRole("heading", {
                name: "An app that adapts to you, not the other way around.",
            }),
        ).toBeVisible();
        await expect(
            page.getByRole("link", {name: "Deutsch"}),
        ).toHaveAttribute("href", "../");
    });
});
