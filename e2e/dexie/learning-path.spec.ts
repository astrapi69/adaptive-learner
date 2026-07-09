/**
 * Learning Path (/learning-path) — personal two-level view + the
 * lazy graph alternative (learning-path redesign). Dexie build, NO
 * backend.
 *
 *   - Fresh visit (no downloads): the empty state renders and its
 *     "browse content" action navigates to /content.
 *   - After playing a real bundled lesson: the set appears as a
 *     Level-1 row; expanding it reveals Level-2 lesson rows; clicking
 *     a lesson row navigates into the viewer.
 *   - At 375px the page does not overflow horizontally.
 *   - The Graph view tab is gated off (LEARNING_PATH_GRAPH disabled, #900).
 *
 * STABLE SELECTORS ONLY: ``data-testid`` anchors + routes.
 */

import {expect, test, type Page} from "@playwright/test";
import {currentStepTestId, waitForStepAdvance} from "./_step-flow";

const SET_ID = "fr-a1-from-en";

/** Download the bundled set and play its first lesson to the summary
 *  (any answers — we only need recorded progress for the path). */
async function playFirstLesson(page: Page): Promise<void> {
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({timeout: 15000});
    await page.getByTestId("content-other-toggle").click();
    await page.getByTestId(`content-set-${SET_ID}-action`).click();
    const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(openBtn).toBeVisible({timeout: 20000});
    await openBtn.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({timeout: 15000});

    for (let i = 0; i < 40; i++) {
        if (await page.getByTestId("lesson-summary").count()) break;
        if (await page.getByTestId("free-text-input").count()) {
            await page.getByTestId("free-text-input").fill("Bonjour");
        } else if (await page.getByTestId("word-tiles-exercise").count()) {
            const tiles = page.locator('[data-testid^="word-tile-scrambled-"]');
            let guard = 0;
            while ((await tiles.count()) > 0 && guard++ < 12) {
                await tiles.first().click();
            }
        } else if (await page.getByTestId("picture-exercise").count()) {
            await page.locator('[data-testid^="picture-choice-"]').first().click();
        } else if (await page.getByTestId("matching-exercise").count()) {
            const lefts = page.getByTestId(/^matching-left-\d+$/);
            const n = await lefts.count();
            for (let j = 0; j < n; j++) {
                await page.getByTestId(`matching-left-${j}`).click();
                await page.getByTestId(`matching-right-${j}`).click();
            }
        } else {
            const blanks = page.locator('[data-testid^="cloze-input-"]');
            const n = await blanks.count();
            for (let j = 0; j < n; j++) await blanks.nth(j).fill("Bonjour");
        }
        const check = page.getByTestId("lesson-check");
        if (await check.count()) {
            await expect(check).toBeEnabled({timeout: 5000});
            await check.click();
        }
        const next = page.getByTestId("lesson-next");
        await expect(next).toBeVisible({timeout: 5000});
        const beforeStep = await currentStepTestId(page);
        await next.click();
        await waitForStepAdvance(page, beforeStep);
    }
    await expect(page.getByTestId("lesson-summary")).toBeVisible({timeout: 15000});
}

test.describe("Learning Path — personal view + graph", () => {
    test("fresh visit shows the empty state and links to content", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto("/learning-path");
        await expect(page.getByTestId("learning-path-page")).toBeVisible({
            timeout: 15000,
        });
        // No downloads yet -> empty state with a "browse content" action.
        await expect(page.getByTestId("learning-path-empty")).toBeVisible();
        await page.getByTestId("learning-path-to-content").click();
        await expect(page.getByTestId("content-tree")).toBeVisible({
            timeout: 15000,
        });

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("after playing a lesson, the set row expands and a lesson opens", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await playFirstLesson(page);

        await page.goto("/learning-path");
        await expect(page.getByTestId("learning-path-page")).toBeVisible({
            timeout: 15000,
        });
        // #1454 fixed the "Only mine" filter (default) to show only sets with
        // recorded activity; before #1454 it was broken and showed every
        // downloaded set. This journey verifies the row expands + a lesson
        // opens, not the filter, so select "All sets" to render the downloaded
        // set regardless of the runtime-fetch activity attribution (#1472).
        await page.getByTestId("learning-path-filter-all").click();
        const row = page.getByTestId(`set-row-${SET_ID}`);
        await expect(row).toBeVisible({timeout: 15000});

        // Expand to Level 2 and open a lesson.
        await page.getByTestId(`set-toggle-${SET_ID}`).click();
        await expect(page.getByTestId(`set-detail-${SET_ID}`)).toBeVisible();
        const lessonRow = page
            .locator(`[data-testid^="lesson-row-${SET_ID}-"]`)
            .first();
        await expect(lessonRow).toBeVisible({timeout: 10000});
        await lessonRow.click();
        await expect(page.getByTestId("lesson-page")).toBeVisible({
            timeout: 15000,
        });

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("renders without horizontal overflow at 375px", async ({page}) => {
        await page.setViewportSize({width: 375, height: 800});
        await playFirstLesson(page);
        await page.goto("/learning-path");
        await expect(page.getByTestId("learning-path-page")).toBeVisible({
            timeout: 15000,
        });
        // "All sets" so the downloaded set renders regardless of the "Only
        // mine" activity attribution (#1454 / #1472).
        await page.getByTestId("learning-path-filter-all").click();
        await expect(page.getByTestId(`set-row-${SET_ID}`)).toBeVisible({
            timeout: 15000,
        });
        await page.getByTestId(`set-toggle-${SET_ID}`).click();
        await expect(page.getByTestId(`set-detail-${SET_ID}`)).toBeVisible();

        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
        );
        expect(overflow, "horizontal overflow at 375px").toBeLessThanOrEqual(1);
    });

    test("the graph view tab is gated off (#900)", async ({page}) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await playFirstLesson(page);
        await page.goto("/learning-path");
        await expect(page.getByTestId("learning-path-page")).toBeVisible({
            timeout: 15000,
        });

        // Map tab is reachable; the Graph tab is disabled until its layout
        // is fixed, so its button is not rendered.
        await expect(page.getByTestId("learning-path-view-map")).toBeVisible();
        await expect(
            page.getByTestId("learning-path-view-graph"),
        ).toHaveCount(0);

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
