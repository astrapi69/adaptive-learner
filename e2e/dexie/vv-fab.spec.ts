/**
 * Sticky measurement-bar toggle (#2799) — device verification.
 * Dexie build, NO backend.
 *
 * With the diagnostics probe (#2782) and the fab pref enabled, the
 * floating button must show, and each press must flip the measurement
 * bar (#2785) — the exact behaviour of the Settings "Show measurement
 * bar" toggle, from anywhere in the app.
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors.
 */

import {expect, test} from "@playwright/test";

test.describe("Sticky bar-toggle fab (#2799)", () => {
    test("shows at the configured corner and toggles the bar", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.addInitScript(() => {
            localStorage.setItem("adaptive-learner.vv_diag", "1");
            localStorage.setItem("adaptive-learner.vv_diag_fab", "1");
        });
        await page.goto("/");

        const fab = page.getByTestId("vv-panel-fab");
        await expect(fab).toBeVisible({timeout: 15000});
        await expect(fab).toHaveAttribute("data-position", "bottom-left");
        // Bar visible by default (#2785); the fab mirrors that state.
        await expect(page.getByTestId("viewport-diagnostic")).toBeVisible();
        await expect(fab).toHaveAttribute("aria-pressed", "true");

        await fab.click();
        await expect(page.getByTestId("viewport-diagnostic")).toHaveCount(0);
        await expect(fab).toHaveAttribute("aria-pressed", "false");

        await fab.click();
        await expect(page.getByTestId("viewport-diagnostic")).toBeVisible();

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("stays hidden without the fab pref, and while the probe is off", async ({
        page,
    }) => {
        // Probe on, fab pref off -> no floating button.
        await page.addInitScript(() => {
            localStorage.setItem("adaptive-learner.vv_diag", "1");
        });
        await page.goto("/");
        await expect(page.getByTestId("viewport-diagnostic")).toBeVisible({
            timeout: 15000,
        });
        await expect(page.getByTestId("vv-panel-fab")).toHaveCount(0);
    });
});
