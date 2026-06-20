/**
 * #43 regression — the lesson content panel must not jump when
 * advancing between steps.
 *
 * Dexie build, no backend. The sticky lesson footer (Prev / Check /
 * Next) is `position: sticky; bottom: 0`. Before the fix, the lesson
 * page was a natural-height block, so on a step whose content was
 * shorter than the viewport the footer floated in the middle of the
 * screen instead of sitting at the bottom — and its vertical position
 * shifted every time the step content height changed (clicking
 * "Weiter"). The fix makes the page a flex column that fills the
 * viewport (`min-h-full`) with the step growing to absorb the slack
 * (`flex-auto`), so the footer is pinned to the viewport bottom on
 * EVERY step.
 *
 * Invariant pinned here: on each step, the footer's bottom edge sits
 * flush with the viewport bottom. A regression (page no longer fills
 * the viewport) lets a short step float the footer above the bottom,
 * failing the assertion.
 */

import { expect, test, type Page } from "@playwright/test";

const SET_ID = "fr-a1-from-en";

/** Footer bottom edge, in viewport coordinates. */
async function footerBottom(page: Page): Promise<number> {
  const box = await page.getByTestId("lesson-footer").boundingBox();
  if (!box) throw new Error("lesson-footer not visible");
  return box.y + box.height;
}

test.describe("#43 — sticky lesson footer stays pinned across steps", () => {
  test("footer bottom stays flush with the viewport bottom on every step", async ({
    page,
  }) => {
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("content-other-toggle").click();
    const action = page.getByTestId(`content-set-${SET_ID}-action`);
    await expect(action).toBeVisible();
    await action.click();
    const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(openBtn).toBeVisible({ timeout: 20000 });
    await openBtn.click();

    await expect(page.getByTestId("lesson-page")).toBeVisible({ timeout: 15000 });

    const viewport = page.viewportSize();
    if (!viewport) throw new Error("no viewport size");

    // Sample the footer position across the first several steps. At
    // least one of these steps (a single short exercise / a short
    // theory card) is shorter than the viewport, which is exactly the
    // case the pre-fix layout floated the footer for.
    let sampled = 0;
    for (let i = 0; i < 6; i++) {
      if (await page.getByTestId("lesson-summary").count()) break;
      // Always scroll to the top so the measurement is taken in the
      // resting state, not mid-scroll (the auto-hide header reacts to
      // scrolling but the sticky footer must stay pinned regardless).
      await page.evaluate(() => document.getElementById("root")?.scrollTo(0, 0));
      await page.waitForTimeout(60);

      const bottom = await footerBottom(page);
      expect(
        Math.abs(bottom - viewport.height),
        `step ${i}: footer bottom (${bottom}) should be flush with viewport bottom (${viewport.height})`,
      ).toBeLessThanOrEqual(2);
      sampled++;

      // Advance: answer (if an exercise), grade via the shared Check
      // button when present, then Next.
      if (await page.getByTestId("free-text-exercise").count()) {
        await page.getByTestId("free-text-input").fill("Bonjour");
      } else if (await page.getByTestId("cloze-exercise").count()) {
        const inputs = page.locator('[data-testid^="cloze-input-"]');
        const n = await inputs.count();
        for (let j = 0; j < n; j++) await inputs.nth(j).fill("Bonjour");
      } else if (await page.getByTestId("word-tiles-exercise").count()) {
        const scrambled = page.locator('[data-testid^="word-tile-scrambled-"]');
        let guard = 0;
        while ((await scrambled.count()) > 0 && guard++ < 12) {
          await scrambled.first().click();
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
      }
      const check = page.getByTestId("lesson-check");
      if (await check.count()) {
        await expect(check).toBeEnabled({ timeout: 5000 });
        await check.click();
      }
      const next = page.getByTestId("lesson-next");
      await expect(next).toBeVisible({ timeout: 5000 });
      await next.click();
      await page.waitForTimeout(80);
    }

    expect(sampled, "sampled at least three steps").toBeGreaterThanOrEqual(3);
  });
});
