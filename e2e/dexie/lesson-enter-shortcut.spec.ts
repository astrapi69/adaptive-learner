/**
 * #103 — Enter-key shortcut in the lesson player.
 *
 * Dexie build, no backend. With the shortcut enabled (default), Enter
 * drives the two-phase footer button:
 *   - on a theory step, Enter advances (= Next),
 *   - on a free-text / cloze exercise, Enter inside the input submits
 *     the answer (= Check), then Enter again advances.
 *
 * The spec navigates the bundled fr-a1-from-en lesson using ONLY the
 * keyboard: reaching the first exercise via repeated Enter proves the
 * theory-advance path (a broken shortcut would leave us stuck on step
 * 0, so no exercise renderer would ever appear and the test would
 * fail). It then checks an input exercise with Enter and advances.
 */

import { expect, test, type Page } from "@playwright/test";
import { currentStepTestId, waitForStepAdvance } from "./_step-flow";

const SET_ID = "fr-a1-from-en";

async function openFirstLesson(page: Page): Promise<void> {
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
}

/** True once a step exposes a gradable exercise (the Check button). */
async function onExerciseStep(page: Page): Promise<boolean> {
  return (await page.getByTestId("lesson-check").count()) > 0;
}

test.describe("#103 — Enter-key lesson shortcut", () => {
  test("Enter advances theory and checks an input exercise", async ({ page }) => {
    await openFirstLesson(page);

    // Move focus off any control so Enter is handled by the lesson
    // listener (not native button activation), then advance theory
    // steps with Enter until the first exercise appears.
    let reachedExercise = false;
    for (let i = 0; i < 12; i++) {
      if (await page.getByTestId("lesson-summary").count()) break;
      if (await onExerciseStep(page)) {
        reachedExercise = true;
        break;
      }
      await page.locator("body").click();
      const beforeStep = await currentStepTestId(page);
      await page.keyboard.press("Enter");
      await waitForStepAdvance(page, beforeStep);
    }

    expect(
      reachedExercise,
      "Enter on theory steps should advance to the first exercise",
    ).toBe(true);

    // Find an input-driven exercise (free-text or cloze) to exercise
    // the "Enter in the field submits" path. Advance with Enter on the
    // footer (focus the Next button, which activates natively) until
    // one appears or the lesson ends.
    let testedInput = false;
    for (let i = 0; i < 12 && !testedInput; i++) {
      if (await page.getByTestId("lesson-summary").count()) break;

      if (await page.getByTestId("free-text-exercise").count()) {
        const input = page.getByTestId("free-text-input");
        await input.fill("Bonjour");
        await input.focus();
        await page.keyboard.press("Enter"); // Check
        await expect(page.getByTestId("lesson-next")).toBeVisible({
          timeout: 5000,
        });
        await expect(page.getByTestId("lesson-check")).toHaveCount(0);
        testedInput = true;
        break;
      }

      if (await page.getByTestId("cloze-exercise").count()) {
        const inputs = page.locator('[data-testid^="cloze-input-"]');
        const n = await inputs.count();
        for (let j = 0; j < n; j++) await inputs.nth(j).fill("Bonjour");
        await inputs.last().focus();
        await page.keyboard.press("Enter"); // Check
        await expect(page.getByTestId("lesson-next")).toBeVisible({
          timeout: 5000,
        });
        await expect(page.getByTestId("lesson-check")).toHaveCount(0);
        testedInput = true;
        break;
      }

      // Not an input exercise — answer it and move on via the footer.
      if (await page.getByTestId("word-tiles-exercise").count()) {
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
      }
      const check = page.getByTestId("lesson-check");
      if (await check.count()) {
        await expect(check).toBeEnabled({ timeout: 5000 });
        await check.click();
      }
      const next = page.getByTestId("lesson-next");
      if (await next.count()) {
        await next.focus();
        const beforeStep = await currentStepTestId(page);
        await page.keyboard.press("Enter"); // Next via native button activation
        await waitForStepAdvance(page, beforeStep);
      }
    }

    // The fr-a1 lessons lead with input exercises; if the layout ever
    // changes so none is reached, the theory-advance assertion above
    // still pins the core shortcut.
    expect(
      testedInput,
      "an input exercise should be reachable to test Enter-to-check",
    ).toBe(true);
  });
});
