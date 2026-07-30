/**
 * v0.6.0 / 9E — mobile viewport pins.
 *
 * Parametrised smoke that runs each canonical mobile viewport
 * + an iPad through three checks per route:
 *   1. No horizontal overflow (``scrollWidth <= clientWidth``).
 *   2. The hamburger button is visible at ≤768px; the nav-links
 *      drawer is closed initially.
 *   3. The page-level ``data-testid`` is reachable (proves the
 *      route mounted, not a 404 / blank-page regression).
 *
 * Manual Lighthouse audit + real-device smoke stay on the
 * smoke-tester side (Phase 9 Q6). These pins are the
 * scripted "no regression" net.
 */

import {expect, test} from "@playwright/test";

import {completeAssessment, completeOnboarding} from "../helpers/onboarding";

interface Viewport {
    name: string;
    width: number;
    height: number;
    expectHamburger: boolean;
}

const VIEWPORTS: Viewport[] = [
    {name: "iPhone SE", width: 375, height: 667, expectHamburger: true},
    {name: "iPhone 14", width: 390, height: 844, expectHamburger: true},
    {name: "Pixel 7", width: 412, height: 915, expectHamburger: true},
    // iPad sits AT the 768px breakpoint. Our media query is
    // ``@media (max-width: 768px)`` which INCLUDES 768. The
    // hamburger SHOULD show.
    {name: "iPad", width: 768, height: 1024, expectHamburger: true},
];

for (const vp of VIEWPORTS) {
    test.describe(`Mobile viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
        test.use({viewport: {width: vp.width, height: vp.height}});

        test("Landing renders without horizontal overflow", async ({page}) => {
            // Landing needs an EMPTY install - identity recovery
            // otherwise redirects "/" to the dashboard of whatever
            // user an earlier spec (or viewport block) created
            // (#2170). The shipped reset endpoint restores it.
            const resp = await page.request.post("/api/reset", {
                data: {confirmation: "RESET"},
            });
            if (!resp.ok()) {
                throw new Error(`landing reset failed: ${resp.status()}`);
            }
            await page.goto("/");
            await expect(page.getByTestId("landing")).toBeVisible();
            const overflow = await page.evaluate(() => {
                const root = document.documentElement;
                return {
                    scrollWidth: root.scrollWidth,
                    clientWidth: root.clientWidth,
                };
            });
            expect(overflow.scrollWidth).toBeLessThanOrEqual(
                overflow.clientWidth,
            );
        });

        test(
            "Dashboard shows hamburger + nav-links drawer is closed",
            async ({page}) => {
                await completeOnboarding(page, {name: `${vp.name} User`});
                await completeAssessment(page);
                await page.waitForURL("**/dashboard");
                await expect(page.getByTestId("dashboard")).toBeVisible();

                if (vp.expectHamburger) {
                    // Hamburger MUST be visible at this viewport.
                    await expect(page.getByTestId("nav-hamburger")).toBeVisible();
                    // Drawer is closed: the ``.is-open`` class is absent.
                    const links = page.getByTestId("nav-links");
                    const klass = await links.getAttribute("class");
                    expect(klass ?? "").not.toContain("is-open");
                }
            },
        );

        test("Dashboard renders without horizontal overflow", async ({page}) => {
            await completeOnboarding(page, {name: `${vp.name} User`});
            await completeAssessment(page);
            await page.waitForURL("**/dashboard");
            await expect(page.getByTestId("dashboard")).toBeVisible();
            const overflow = await page.evaluate(() => {
                const root = document.documentElement;
                return {
                    scrollWidth: root.scrollWidth,
                    clientWidth: root.clientWidth,
                };
            });
            // Allow 1px of rounding slack — sub-pixel layout can
            // produce scrollWidth=clientWidth+1 on some renderers
            // even with a perfectly responsive layout.
            expect(overflow.scrollWidth).toBeLessThanOrEqual(
                overflow.clientWidth + 1,
            );
        });
    });
}
