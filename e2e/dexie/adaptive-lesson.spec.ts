/**
 * Adaptive lesson generation + completion (Phase 61 E2E, journey e).
 *
 * Dexie build, no backend. Seeds element errors by playing a
 * bundled lesson with wrong answers, then opens the adaptive
 * session for that set. When enough same-focus errors cluster
 * (CLUSTER_MIN = 3) the rule-based generator builds a personalised
 * lesson — we play it to its scored summary. When the errors don't
 * reach the cluster threshold the page shows its graceful
 * "nothing to review yet" state with a CTA; both are valid renders
 * and the journey asserts whichever the seeded data produces.
 */

import { expect, test, type Page } from "@playwright/test";

const SET_ID = "fr-a1-from-de"; // German-source set: in the primary tree

// Plays the REGULAR Lesson page (which runs exercises in the
// two-phase / controlled mode), answering wrong to seed element
// errors. There is no per-exercise submit button here: the shared
// "Check" (lesson-check) button grades, then lesson-next advances.
async function answerWrongAndAdvance(page: Page, maxSteps: number): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    if (await page.getByTestId("lesson-summary").count()) break;
    if (await page.getByTestId("free-text-exercise").count()) {
      await page.getByTestId("free-text-input").fill("zzz");
    } else if (await page.getByTestId("cloze-exercise").count()) {
      const inputs = page.locator('[data-testid^="cloze-input-"]');
      const n = await inputs.count();
      for (let j = 0; j < n; j++) await inputs.nth(j).fill("zzz");
    } else if (await page.getByTestId("word-tiles-exercise").count()) {
      const scrambled = page.locator('[data-testid^="word-tile-scrambled-"]');
      let g = 0;
      while ((await scrambled.count()) > 0 && g++ < 12) await scrambled.first().click();
    } else if (await page.getByTestId("matching-exercise").count()) {
      // Pair left-i with right-i (shuffled originals -> wrong pairs).
      const n = await page.getByTestId(/^matching-left-\d+$/).count();
      for (let k = 0; k < n; k++) {
        await page.getByTestId(`matching-left-${k}`).click();
        await page.getByTestId(`matching-right-${k}`).click();
      }
    }
    // Two-phase: grade an exercise step via the shared Check button
    // (enabled once answered) before advancing; theory steps go
    // straight to Next.
    const check = page.getByTestId("lesson-check");
    if (await check.count()) {
      await expect(check).toBeEnabled({ timeout: 5000 });
      await check.click();
    }
    const next = page.getByTestId("lesson-next");
    if ((await next.count()) && (await next.isEnabled().catch(() => false))) {
      await next.click();
    }
    await page.waitForTimeout(80);
  }
}

async function playAdaptive(page: Page, maxSteps: number): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    if (await page.getByTestId("adaptive-lesson-summary").count()) break;
    // Reuse the same generic answer logic; the adaptive lesson uses
    // the identical exercise renderers.
    if (await page.getByTestId("free-text-exercise").count()) {
      await page.getByTestId("free-text-input").fill("zzz");
      await page.getByTestId("free-text-submit").click();
    } else if (await page.getByTestId("cloze-exercise").count()) {
      const inputs = page.locator('[data-testid^="cloze-input-"]');
      const n = await inputs.count();
      for (let j = 0; j < n; j++) await inputs.nth(j).fill("zzz");
      await page.getByTestId("cloze-submit").click();
    } else if (await page.getByTestId("word-tiles-exercise").count()) {
      const scrambled = page.locator('[data-testid^="word-tile-scrambled-"]');
      let g = 0;
      while ((await scrambled.count()) > 0 && g++ < 12) await scrambled.first().click();
      await page.getByTestId("word-tiles-submit").click();
    } else if (await page.getByTestId("matching-exercise").count()) {
      const n = await page.getByTestId(/^matching-left-\d+$/).count();
      for (let k = 0; k < n; k++) {
        await page.getByTestId(`matching-left-${k}`).click();
        await page.getByTestId(`matching-right-${k}`).click();
      }
      await page.getByTestId("matching-submit").click();
    }
    const next = page.getByTestId("adaptive-lesson-next");
    if ((await next.count()) && (await next.isEnabled().catch(() => false))) {
      await next.click();
    }
    await page.waitForTimeout(120);
  }
}

test.describe("Adaptive lesson — generation + completion", () => {
  test("seed errors, then generate + complete (or render the graceful empty state)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // 1) Download the set + play its first lesson with wrong answers
    //    to record element errors.
    await page.goto("/content");
    await expect(page.getByTestId("content-tree")).toBeVisible({ timeout: 15000 });
    const action = page.getByTestId(`content-set-${SET_ID}-action`);
    await expect(action).toBeVisible({ timeout: 15000 });
    await action.click();
    const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(openBtn).toBeVisible({ timeout: 20000 });
    await openBtn.click();
    await expect(page.getByTestId("lesson-page")).toBeVisible({ timeout: 15000 });
    await answerWrongAndAdvance(page, 30);
    await expect(page.getByTestId("lesson-summary")).toBeVisible({ timeout: 15000 });

    // 2) Open the adaptive session for the set.
    await page.goto(`/adaptive-lesson/${SET_ID}`);
    const pageEl = page.getByTestId("adaptive-lesson-page");
    const empty = page.getByTestId("adaptive-lesson-empty");
    await expect(pageEl.or(empty)).toBeVisible({ timeout: 15000 });

    if (await pageEl.count()) {
      // Generated: transparency panel shows focus areas, then play
      // through to the scored summary.
      await expect(page.getByTestId("adaptive-transparency")).toBeVisible();
      await playAdaptive(page, 40);
      await expect(page.getByTestId("adaptive-lesson-summary")).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByTestId("adaptive-summary-score")).toBeVisible();
    } else {
      // No clustered errors for an anonymous first-visit session
      // (element errors record under a user id; generation itself is
      // unit-pinned in lesson-generator.test.ts). The route must
      // still render its graceful empty state without crashing.
      await expect(empty).toBeVisible();
    }

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
