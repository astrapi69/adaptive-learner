/**
 * Learning Path (/learning-path) — graph render + navigation
 * (E2E hardening). Dexie build, NO backend.
 *
 *   - Fresh visit (no progress): the empty state renders and its
 *     "browse content" action navigates to /content.
 *   - After playing a real bundled lesson: the @xyflow graph renders
 *     with a lesson node for the played lesson; clicking that node
 *     navigates into the lesson viewer.
 *
 * STABLE SELECTORS ONLY (Phase-B-proof): ``data-testid`` anchors +
 * routes. The graph canvas/node interaction uses the node's own
 * ``lesson-node-{setId}-{filename}`` testid (a real <button>), not a
 * canvas-coordinate click.
 */

import {expect, test, type Page} from "@playwright/test";

const SET_ID = "fr-a1-from-en";

/** Download the bundled set and play its first lesson to the summary
 *  (any answers — we only need recorded progress for the graph). */
async function playFirstLesson(page: Page): Promise<void> {
    await page.goto("/content");
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
        await next.click();
        await page.waitForTimeout(80);
    }
    await expect(page.getByTestId("lesson-summary")).toBeVisible({timeout: 15000});
}

test.describe("Learning Path — graph + navigation", () => {
    test("fresh visit shows the empty state and links to content", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto("/learning-path");
        await expect(page.getByTestId("learning-path-page")).toBeVisible({
            timeout: 15000,
        });
        // No progress yet -> empty state with a "browse content" action.
        await expect(page.getByTestId("learning-path-empty")).toBeVisible();
        await page.getByTestId("learning-path-to-content").click();
        await expect(page.getByTestId("content-tree")).toBeVisible({
            timeout: 15000,
        });

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });

    test("after playing a lesson, the graph renders a node that opens it", async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await playFirstLesson(page);

        await page.goto("/learning-path");
        await expect(page.getByTestId("learning-path-page")).toBeVisible({
            timeout: 15000,
        });
        await expect(page.getByTestId("learning-path-canvas")).toBeVisible({
            timeout: 15000,
        });

        // A node for the played set is present; the played lesson is
        // unlocked, so clicking it navigates into the lesson viewer.
        const node = page
            .locator(`[data-testid^="lesson-node-${SET_ID}-"]`)
            .first();
        await expect(node).toBeVisible({timeout: 10000});
        await node.click();
        await expect(page.getByTestId("lesson-page")).toBeVisible({
            timeout: 15000,
        });

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
