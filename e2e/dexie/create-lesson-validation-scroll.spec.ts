/**
 * #2036 — Create-Lesson: an invalid step-1 submit must bring the required
 * title field (and its inline error) INTO VIEW with focus. Before the fix the
 * error rendered at the top of the form while the Next / book / extension
 * triggers sat below the fold, so on a narrow mobile viewport the click read
 * as a dead end (no visible reaction).
 *
 * Coverage: all three wizard entries (normal card / book / extension) at a
 * mobile viewport, an axe pass on the visible error state, and a desktop
 * regression proving the field is NOT scrolled when it is already visible.
 *
 * Dexie build, NO backend. STABLE SELECTORS ONLY (``data-testid``). The
 * ``toBeInViewport`` / ``toBeFocused`` matchers auto-retry, so they settle
 * across the smooth scroll without arbitrary waits.
 */

import AxeBuilder from "@axe-core/playwright";
import {expect, test, type Page} from "@playwright/test";

/** Open the creator on a clean step 1 with an empty title (the only required
 *  field). Each Playwright test gets an isolated context, so no draft prompt
 *  is expected; handled defensively anyway. */
async function openFresh(page: Page): Promise<void> {
    await page.goto("/create-lesson");
    await expect(page.getByTestId("create-lesson-page")).toBeVisible({
        timeout: 15000,
    });
    if (await page.getByTestId("create-lesson-draft-prompt").count()) {
        await page.getByTestId("create-lesson-draft-fresh").click();
    }
    await expect(page.getByTestId("create-lesson-title")).toBeVisible();
    // The title auto-focuses on mount; drop focus so the "moved focus back to
    // the title" assertion is meaningful.
    await page
        .getByTestId("create-lesson-title")
        .evaluate((el) => (el as HTMLInputElement).blur());
}

/** rect.top of a testid element, relative to the viewport (getBoundingClientRect). */
function rectTop(page: Page, testid: string): Promise<number> {
    return page
        .getByTestId(testid)
        .evaluate((el) => el.getBoundingClientRect().top);
}

test.describe("#2036 title validation scrolled into view (mobile 375px)", () => {
    test.use({viewport: {width: 375, height: 600}});

    test("normal path: invalid Next brings the title + error into view, focused", async ({
        page,
    }) => {
        await openFresh(page);
        const title = page.getByTestId("create-lesson-title");

        // Real mobile situation: scroll to the bottom Next button so the title
        // is above the fold.
        await page.getByTestId("create-lesson-next").scrollIntoViewIfNeeded();
        // RED PRECONDITION: the title is entirely out of the viewport.
        await expect(title).not.toBeInViewport();

        await page.getByTestId("create-lesson-next").click();

        // GREEN: the title (and its error) are in view and the title is focused.
        await expect(title).toBeFocused();
        await expect(title).toBeInViewport();
        await expect(page.getByTestId("create-lesson-title-error")).toBeInViewport();
        // Still on step 1 (invalid submit did not advance).
        await expect(page.getByTestId("create-lesson-step-1")).toBeVisible();
        await expect(page.getByTestId("create-lesson-step-2")).toHaveCount(0);
    });

    test("book entry: invalid start brings the title + error into view, focused", async ({
        page,
    }) => {
        await openFresh(page);
        const trigger = page.getByTestId("template-knowledge-from-text");
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();

        await expect(page.getByTestId("create-lesson-title")).toBeFocused();
        await expect(page.getByTestId("create-lesson-title-error")).toBeInViewport();
        // Stayed on step 1 — did NOT enter book mode title-less.
        await expect(page.getByTestId("create-lesson-step-1")).toBeVisible();
    });

    test("extension entry: invalid start brings the title + error into view, focused", async ({
        page,
    }) => {
        await openFresh(page);
        const trigger = page.getByTestId("template-extensions");
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();

        await expect(page.getByTestId("create-lesson-title")).toBeFocused();
        await expect(page.getByTestId("create-lesson-title-error")).toBeInViewport();
        await expect(page.getByTestId("create-lesson-step-1")).toBeVisible();
    });

    test("axe: the visible title-error field has no violations", async ({
        page,
    }) => {
        await openFresh(page);
        await page.getByTestId("create-lesson-next").click();
        await expect(
            page.getByTestId("create-lesson-title-error"),
        ).toBeVisible();
        // Scope to the title field this fix touches (input aria-invalid +
        // aria-describedby, the role="alert" message). The wider step-1 has a
        // pre-existing, unrelated button-name gap on the shadcn Select triggers
        // (create-lesson-source/target/level) tracked separately — not this
        // one-concern PR.
        const results = await new AxeBuilder({page})
            .include('[data-testid="create-lesson-title-field"]')
            .analyze();
        expect(results.violations).toEqual([]);
    });
});

test.describe("#2036 desktop regression (no scroll jump when already visible)", () => {
    // Tall enough that the entire step-1 form fits — both the title AND the
    // bottom Next button are on screen — so clicking Next triggers no
    // auto-scroll and the "already visible" precondition genuinely holds.
    test.use({viewport: {width: 1280, height: 1400}});

    test("invalid Next shows the error and focuses the title without moving it", async ({
        page,
    }) => {
        await openFresh(page);
        const title = page.getByTestId("create-lesson-title");
        const next = page.getByTestId("create-lesson-next");

        // Settle the scroll position BEFORE measuring. Playwright scrolls a
        // click target into view automatically, and ``toBeInViewport()`` is
        // satisfied by PARTIAL visibility - so on a shorter/denser render (CI)
        // the click itself shifted the page a few px and the assertion below
        // measured Playwright's scroll, not ours (observed: 7px).
        await next.scrollIntoViewIfNeeded();
        // Precondition for this regression: the title is fully on screen, so
        // flagTitleError() must NOT scroll at all.
        await expect(title).toBeInViewport({ratio: 1});
        const topBefore = await rectTop(page, "create-lesson-title");

        await next.click();

        await expect(
            page.getByTestId("create-lesson-title-error"),
        ).toBeVisible();
        await expect(title).toBeFocused();
        const topAfter = await rectTop(page, "create-lesson-title");
        // Already-visible field is not scrolled: its viewport position is
        // unchanged (allow sub-pixel rounding).
        expect(Math.abs(topAfter - topBefore)).toBeLessThanOrEqual(1);
    });
});
