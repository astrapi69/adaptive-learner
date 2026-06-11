/**
 * Theme visual-regression matrix (#244, infra block 8).
 *
 * 5 critical views × 12 registered themes = 60 desktop (1440×900)
 * screenshots. Each test pins a theme before first paint, seeds the view
 * into a deterministic state (dexie build, no backend), and pixel-compares
 * against the committed baseline (``e2e/visual/screenshots/``).
 *
 * Generating / updating the baseline (maintainer, on a consistent machine):
 *   1. build the dexie frontend (``make test-visual`` builds it for you), then
 *   2. ``npx playwright test -c playwright.visual.config.ts --update-snapshots``
 *   3. REVIEW every changed PNG before committing. NEVER ``--update-snapshots``
 *      to silence a diff that reveals a real bug — fix the bug.
 *
 * A view that can't be reached deterministically (e.g. the bundled set has
 * no matching exercise) is skipped with a clear message rather than
 * committing a meaningless baseline.
 */

import {expect, test} from "@playwright/test";

import {THEME_IDS, VIEW_NAMES, gotoView, setTheme} from "./helpers";

for (const theme of THEME_IDS) {
    for (const view of VIEW_NAMES) {
        test(`${view} renders correctly in ${theme}`, async ({page}) => {
            await setTheme(page, theme);
            const ready = await gotoView(page, view);
            test.skip(!ready, `Could not reach ${view} deterministically`);
            // Let fonts + lazy chunks settle; animations are disabled by config.
            await page.waitForLoadState("networkidle");
            await expect(page).toHaveScreenshot(`${view}-${theme}.png`, {
                fullPage: true,
            });
        });
    }
}
