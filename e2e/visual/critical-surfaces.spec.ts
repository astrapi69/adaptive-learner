/**
 * Critical-surfaces visual-regression matrix (#705, Phase 1).
 *
 * 16 critical user-facing surfaces × 3 responsive viewports (desktop
 * 1920×1080, tablet 768×1024, mobile 375×667) in the DEFAULT theme. Each
 * test pins the viewport + a deterministic default theme before first
 * paint, seeds the surface into a stable state (dexie build, no backend),
 * and pixel-compares against the committed baseline
 * (``e2e/visual/screenshots/``).
 *
 * Complements ``theme-regression.spec.ts`` (#244, Phase 2): that suite is
 * 5 views × 12 themes at one desktop size; this one is many surfaces × 3
 * sizes at one theme — together they cover both axes without the full
 * Cartesian product blowing up the baseline count.
 *
 * The default theme is pinned to ``light`` explicitly (not left to OS
 * ``prefers-color-scheme``) so the baseline is machine-independent.
 *
 * Generating / updating the baseline (maintainer, on a consistent machine):
 *   1. build the dexie frontend (``make test-visual`` builds it for you), then
 *   2. ``npx playwright test -c playwright.visual.config.ts --update-snapshots``
 *   3. REVIEW every changed PNG before committing. NEVER ``--update-snapshots``
 *      to silence a diff that reveals a real bug — fix the bug.
 *
 * A surface that can't be reached deterministically (e.g. the bundled set
 * has no cloze exercise) is skipped with a clear message rather than
 * committing a meaningless baseline.
 */

import {expect, test} from "@playwright/test";

import {
    SURFACE_NAMES,
    VIEWPORTS,
    type ViewportName,
    freezeClock,
    gotoSurface,
    setTheme,
    settleForScreenshot,
} from "./helpers";

const VIEWPORT_NAMES = Object.keys(VIEWPORTS) as ViewportName[];

for (const surface of SURFACE_NAMES) {
    for (const viewport of VIEWPORT_NAMES) {
        test(`${surface} renders correctly at ${viewport}`, async ({page}) => {
            await page.setViewportSize(VIEWPORTS[viewport]);
            // Determinism: freeze the clock + pin the default theme before
            // the first navigation, then seed/await the surface's own ready
            // signal (gotoSurface), then settle fonts + kill animations.
            await freezeClock(page);
            await setTheme(page, "light");
            const ready = await gotoSurface(page, surface);
            test.skip(!ready, `Could not reach ${surface} deterministically`);
            await settleForScreenshot(page);
            await expect(page).toHaveScreenshot(`${surface}-${viewport}.png`, {
                fullPage: true,
            });
        });
    }
}
