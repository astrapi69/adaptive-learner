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
    assertSurfaceStillReady,
    expandViewportToDocument,
    freezeClock,
    gotoSurface,
    pinContentRegistry,
    setTheme,
    settleForScreenshot,
} from "./helpers";

const VIEWPORT_NAMES = Object.keys(VIEWPORTS) as ViewportName[];

for (const surface of SURFACE_NAMES) {
    for (const viewport of VIEWPORT_NAMES) {
        test(`${surface} renders correctly at ${viewport}`, async ({page}) => {
            await page.setViewportSize(VIEWPORTS[viewport]);
            // Determinism: freeze the clock, pin the default theme, and pin
            // the content-repo registry fetch to a frozen fixture (#1653 —
            // the recommended-repos list is otherwise fetched live and
            // re-stales the settings-data / content-discover baselines) before
            // the first navigation, then seed/await the surface's own ready
            // signal (gotoSurface), then settle fonts + kill animations.
            await freezeClock(page);
            await setTheme(page, "light");
            await pinContentRegistry(page);
            const ready = await gotoSurface(page, surface);
            test.skip(!ready, `Could not reach ${surface} deterministically`);
            await settleForScreenshot(page);
            // #2696 - grow the viewport to the document height and take a
            // plain shot instead of ``fullPage: true``: captureBeyondViewport
            // never painted below the viewport on this app's nested-scroll
            // layout, leaving every tall-page baseline blank from ~viewport
            // height down. A viewport-sized page is a no-op here.
            await expandViewportToDocument(page);
            // #1540 - the .lesson-header h1 line-height pin removed most of the
            // bistable title-height shift, but lesson-matching@mobile keeps a
            // ~5px residual (observed ratio 0.05, content-identical). Allow it
            // on this one shot (0.08 > the residual, still far below any real
            // regression) so it is deterministic; the line-height pin is the
            // actual root-cause fix, this only covers the remainder.
            // #2712 - the config-level absolute maxDiffPixels (2,500) still
            // applies on top of a per-shot ratio (Playwright takes the
            // minimum), so this override must raise BOTH bounds or the 0.08
            // ratio is dead letter: 0.05 of mobile 375x667 is ~12.5k pixels.
            const shotOpts =
                surface === "lesson-matching" && viewport === "mobile"
                    ? {maxDiffPixelRatio: 0.08, maxDiffPixels: 20_000}
                    : {};
            // #2703 - fail loud if the surface's ready-state collapsed
            // between gotoSurface and here, instead of silently
            // photographing whatever it collapsed into.
            await assertSurfaceStillReady(page, surface);
            await expect(page).toHaveScreenshot(`${surface}-${viewport}.png`, shotOpts);
        });
    }
}
