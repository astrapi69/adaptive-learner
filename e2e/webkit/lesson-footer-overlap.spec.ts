/**
 * #1834 — lesson footer Pause/Next overlap, proven under REAL WebKit.
 *
 * The bug: the lesson footer laid out Previous / Pause / Next with
 * ``flex … justify-content: space-between`` and no ``shrink-0``. When the
 * row's content approaches/overflows the container on a narrow (iOS)
 * viewport, WebKit distributes the NEGATIVE free space by OVERLAPPING the
 * items (Blink clamps to flex-start instead), so the Pause button clips
 * the left edge of the "Weiter" label ("Veiter"). This is a pure CSS
 * ENGINE difference — a Chromium bounding-box test can never reproduce it,
 * which is exactly why this spec runs under Playwright's ``webkit`` engine
 * (see ``playwright.webkit.config.ts``, run via ``make test-webkit``).
 *
 * The fix (commit for #1834) removed ``justify-between`` and centres the
 * pause with auto-margins (``mx-auto`` practice / ``mr-auto`` exam) plus
 * ``shrink-0`` on every button. Auto-margins clamp to 0 on overflow
 * (margins never go negative), so the buttons push apart instead of
 * overlapping.
 *
 * The invariant asserted here is engine-independent and width-independent:
 * the pause button's right edge is never past the action button's left
 * edge (they never share horizontal space). It is checked across a width
 * sweep whose narrow end deliberately drives the footer into the
 * flex-overflow regime — the exact regime where old-code WebKit overlaps —
 * so this spec is RED on the pre-fix layout under WebKit and GREEN on the
 * fix. Real Chromium stays green either way (it does not overlap), which
 * is the point: this gate covers what the Chromium gate structurally
 * cannot.
 *
 * Runs under an emulated iPhone 12 profile (realistic mobile UA / DSR /
 * touch — see ``playwright.webkit.config.ts``) and additionally sweeps
 * narrower widths to reach the overflow regime.
 *
 * Navigation mirrors the CI-green ``lesson-playthrough`` gate: it opens the
 * BUNDLED fr-a1-from-en set (shipped inside the GH-Pages/Dexie build — no
 * network, no content-repo connect UI). The first step is theory, so the
 * footer immediately shows Previous + Pause + Next ("Weiter") — the
 * reported scenario.
 */

import {expect, test, type Page} from "@playwright/test";

const SET_ID = "fr-a1-from-en";

/** Widths (CSS px) at which the footer invariant is checked. 375 / 360 /
 *  320 are real iOS device widths (iPhone SE..mini). 280 and 260
 *  deliberately push the three-button row past the container width so the
 *  flex-overflow regime — where iOS WebKit's space-between overlaps items —
 *  is exercised deterministically, independent of exact label pixel
 *  widths. The auto-margin fix keeps the buttons disjoint at ALL of them. */
const NARROW_WIDTHS = [375, 360, 320, 280, 260];

/** Open the first (theory) lesson step of the bundled fr-a1-from-en set,
 *  where the footer shows Previous + Pause + Next ("Weiter").
 *
 *  The content browser's set tree is width-gated (the mobile layout
 *  collapses it), so navigate at a wide viewport. The emulated device's
 *  realistic bits (mobile UA / device-scale-factor / touch) are set at
 *  context creation and PERSIST across setViewportSize — only the
 *  dimensions change — so the later narrow-width footer measurement is
 *  still computed in the mobile rendering context. */
async function openLesson(page: Page): Promise<void> {
    await page.setViewportSize({width: 1024, height: 1400});
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({timeout: 15000});
    // The English-source set sits under "other source languages".
    await page.getByTestId("content-other-toggle").click();
    const action = page.getByTestId(`content-set-${SET_ID}-action`);
    await expect(action).toBeVisible();
    await action.click(); // download (idempotent)
    const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(openBtn).toBeVisible({timeout: 20000});
    await openBtn.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 15000});
    // Theory step → the forward button reads "Weiter" (lesson-next).
    await expect(page.getByTestId("lesson-next")).toBeVisible({timeout: 10000});
}

/** Bounding boxes of the footer pause button and the forward action. */
async function footerBoxes(page: Page) {
    const pause = await page.getByTestId("lesson-pause-btn").boundingBox();
    const next = await page.getByTestId("lesson-next").boundingBox();
    return {pause, next};
}

test.describe("#1834 — footer Pause/Next never overlap (WebKit engine)", () => {
    test("pause and the forward button stay horizontally disjoint at every narrow width", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await openLesson(page);

        for (const width of NARROW_WIDTHS) {
            await page.setViewportSize({width, height: 667});
            await expect(page.getByTestId("lesson-pause-btn")).toBeVisible();
            await expect(page.getByTestId("lesson-next")).toBeVisible();

            const {pause, next} = await footerBoxes(page);
            expect(pause, `pause box @${width}px`).not.toBeNull();
            expect(next, `next box @${width}px`).not.toBeNull();

            // The invariant: pause's right edge is at or before the action
            // button's left edge — no shared horizontal space, no clipped
            // "Weiter". Pre-fix WebKit violates this in the overflow regime.
            expect(
                pause!.x + pause!.width,
                `pause right edge (${pause!.x + pause!.width}) must not cross next left edge (${next!.x}) @${width}px`,
            ).toBeLessThanOrEqual(Math.round(next!.x) + 1);

            // Both stay 44px touch targets (a11y).
            expect(pause!.width, `pause width @${width}px`).toBeGreaterThanOrEqual(44);
            expect(pause!.height, `pause height @${width}px`).toBeGreaterThanOrEqual(44);
        }

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
