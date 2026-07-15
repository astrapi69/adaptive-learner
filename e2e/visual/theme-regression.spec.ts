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

import {
    THEME_IDS,
    VIEW_NAMES,
    freezeClock,
    gotoView,
    pinContentRegistry,
    setTheme,
    settleForScreenshot,
} from "./helpers";

for (const theme of THEME_IDS) {
    for (const view of VIEW_NAMES) {
        test(`${view} renders correctly in ${theme}`, async ({page}) => {
            // Determinism (follows #244): freeze the clock + pin the theme
            // before the first navigation, then seed/await the view's own
            // ready signal (gotoView), then settle fonts + kill animations.
            await freezeClock(page);
            await setTheme(page, theme);
            await pinContentRegistry(page);
            const ready = await gotoView(page, view);
            test.skip(!ready, `Could not reach ${view} deterministically`);
            await settleForScreenshot(page);
            await expect(page).toHaveScreenshot(`${view}-${theme}.png`, {
                fullPage: true,
            });
        });
    }
}
