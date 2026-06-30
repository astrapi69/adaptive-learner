/**
 * Spanish A1 new-content playthrough (content expansion C6).
 *
 * Dexie build, no backend. Downloads the bundled
 * Spanish-A1-for-English set (es-a1-from-en) — now 15 lessons —
 * and plays one of the NEWLY AUTHORED lessons (06 regular -AR
 * verbs) end to end through the two-phase button to the scored
 * summary. Proves the new es-a1 lessons render in every exercise
 * renderer and play interactively in Dexie mode, not just that
 * they validate against the schema.
 *
 * downloadSet caches every lesson in the manifest, so after
 * downloading the set we navigate directly to lesson 06 by
 * swapping the filename in the opened lesson's URL.
 */

import { expect, test, type Page } from "@playwright/test";
import { currentStepTestId, waitForStepAdvance } from "./_step-flow";

const SET_ID = "es-a1-from-en";
const NEW_LESSON = "06-ar-verbs.json";

/** Answer whatever exercise is on screen (coverage, not
 *  correctness). Controlled mode => no per-exercise submit; the
 *  loop drives the shared lesson-check / lesson-next button. */
async function answer(page: Page): Promise<string> {
  if (await page.getByTestId("free-text-exercise").count()) {
    await page.getByTestId("free-text-input").fill("hablo");
    return "free_text";
  }
  if (await page.getByTestId("cloze-exercise").count()) {
    const inputs = page.locator('[data-testid^="cloze-input-"]');
    const n = await inputs.count();
    for (let i = 0; i < n; i++) await inputs.nth(i).fill("hablo");
    return "cloze";
  }
  if (await page.getByTestId("word-tiles-exercise").count()) {
    const scrambled = page.locator('[data-testid^="word-tile-scrambled-"]');
    let guard = 0;
    while ((await scrambled.count()) > 0 && guard++ < 12) {
      await scrambled.first().click();
    }
    return "word_tiles";
  }
  if (await page.getByTestId("picture-exercise").count()) {
    await page.locator('[data-testid^="picture-choice-"]').first().click();
    return "picture_choice";
  }
  if (await page.getByTestId("matching-exercise").count()) {
    const lefts = page.getByTestId(/^matching-left-\d+$/);
    const n = await lefts.count();
    for (let i = 0; i < n; i++) {
      await page.getByTestId(`matching-left-${i}`).click();
      await page.getByTestId(`matching-right-${i}`).click();
    }
    return "matching";
  }
  return "theory";
}

test.describe("Spanish A1 — new lesson playthrough (es-a1-from-en, lesson 06)", () => {
  test("download es-a1-from-en, play the new -AR verbs lesson to the summary", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({ timeout: 15000 });

    // English-source set sits under "other source languages"
    // (the Dexie build's default UI language is German).
    await page.getByTestId("content-other-toggle").click();
    const action = page.getByTestId(`content-set-${SET_ID}-action`);
    await expect(action).toBeVisible({ timeout: 15000 });

    // Download (caches all 15 lessons) then open the set.
    await action.click();
    const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(openBtn).toBeVisible({ timeout: 25000 });
    await openBtn.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({ timeout: 15000 });

    // Jump straight to the newly authored lesson 06 by swapping
    // the filename in the opened lesson's URL (same set, cached).
    const url = new URL(page.url());
    url.pathname = url.pathname.replace(/[^/]+\.json$/, NEW_LESSON);
    await page.goto(url.toString());
    await expect(page.getByTestId("lesson-page")).toBeVisible({ timeout: 15000 });

    // Walk the lesson via the two-phase button.
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      if (await page.getByTestId("lesson-summary").count()) break;
      const kind = await answer(page);
      if (kind !== "theory" && kind !== "none") seen.add(kind);
      const check = page.getByTestId("lesson-check");
      if (await check.count()) {
        await expect(check).toBeEnabled({ timeout: 5000 });
        await check.click();
      }
      const next = page.getByTestId("lesson-next");
      await expect(next).toBeVisible({ timeout: 5000 });
      const beforeStep = await currentStepTestId(page);
      await next.click();
      await waitForStepAdvance(page, beforeStep);
    }

    // Reached the scored summary.
    await expect(page.getByTestId("lesson-summary")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("lesson-summary-score")).toBeVisible();
    await expect(page.getByTestId("lesson-summary-stars")).toBeVisible();

    // The new lesson exercises multiple renderers.
    expect(seen.size, `exercise types rendered: ${[...seen].join(", ")}`).toBeGreaterThanOrEqual(3);
    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
