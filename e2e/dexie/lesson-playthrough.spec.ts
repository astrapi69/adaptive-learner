/**
 * Full lesson playthrough (Phase 61 E2E, journey c).
 *
 * Dexie build, no backend. Downloads the bundled French-A1-for-
 * English set and plays its first lesson (01-greetings) end to
 * end. That lesson exercises ALL FIVE exercise types — matching,
 * free-text, word-tiles, cloze, picture-choice — and ends on the
 * scored summary. The loop is correctness-agnostic on purpose:
 * the coverage goal is traversing every exercise renderer and
 * reaching the summary with a score, not a perfect run.
 */

import { expect, test, type Page } from "@playwright/test";

const SET_ID = "fr-a1-from-en";

/** Advance the lesson one step: answer whatever exercise is on
 *  screen (any answer — we just need to submit + advance), then
 *  click Next. Returns the exercise type seen, or "theory"/"none". */
async function step(page: Page): Promise<string> {
  // free-text
  if (await page.getByTestId("free-text-exercise").count()) {
    await page.getByTestId("free-text-input").fill("Bonjour");
    await page.getByTestId("free-text-submit").click();
    return "free_text";
  }
  // cloze (one or more blanks)
  if (await page.getByTestId("cloze-exercise").count()) {
    const inputs = page.locator('[data-testid^="cloze-input-"]');
    const n = await inputs.count();
    for (let i = 0; i < n; i++) await inputs.nth(i).fill("Bonjour");
    await page.getByTestId("cloze-submit").click();
    return "cloze";
  }
  // word-tiles: click each scrambled tile until none remain
  if (await page.getByTestId("word-tiles-exercise").count()) {
    const scrambled = page.locator('[data-testid^="word-tile-scrambled-"]');
    let guard = 0;
    while ((await scrambled.count()) > 0 && guard++ < 12) {
      await scrambled.first().click();
    }
    await page.getByTestId("word-tiles-submit").click();
    return "word_tiles";
  }
  // picture-choice: pick the first choice
  if (await page.getByTestId("picture-exercise").count()) {
    await page.locator('[data-testid^="picture-choice-"]').first().click();
    await page.getByTestId("picture-submit").click();
    return "picture_choice";
  }
  // matching: pair each left tile with the right whose original
  // index matches its position. Both testids run 0..n-1 (the
  // `-header` testids are excluded by the numeric regex). Pairing
  // every left enables submit (correctness is checked after).
  if (await page.getByTestId("matching-exercise").count()) {
    const lefts = page.getByTestId(/^matching-left-\d+$/);
    const n = await lefts.count();
    for (let i = 0; i < n; i++) {
      await page.getByTestId(`matching-left-${i}`).click();
      await page.getByTestId(`matching-right-${i}`).click();
    }
    await page.getByTestId("matching-submit").click();
    return "matching";
  }
  return "theory";
}

test.describe("Lesson playthrough — all 5 exercise types", () => {
  test("download fr-a1-from-en, play 01-greetings to the scored summary", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/content");
    await expect(page.getByTestId("content-tree")).toBeVisible({ timeout: 15000 });

    // The English-source set sits under "other source languages".
    await page.getByTestId("content-other-toggle").click();
    const action = page.getByTestId(`content-set-${SET_ID}-action`);
    await expect(action).toBeVisible();

    // Download (idempotent) then open.
    await action.click();
    const openBtn = page.getByTestId(`content-set-${SET_ID}-open`);
    await expect(openBtn).toBeVisible({ timeout: 20000 });
    await openBtn.click();

    await expect(page.getByTestId("lesson-page")).toBeVisible({ timeout: 15000 });

    // Walk the lesson. Cap iterations; break on the summary.
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      if (await page.getByTestId("lesson-summary").count()) break;
      const kind = await step(page);
      if (kind !== "theory" && kind !== "none") seen.add(kind);
      // Advance if a Next button is present + enabled.
      const next = page.getByTestId("lesson-next");
      if (await next.count()) {
        if (await next.isEnabled().catch(() => false)) {
          await next.click();
        }
      }
      await page.waitForTimeout(120);
    }

    // Reached the scored summary.
    await expect(page.getByTestId("lesson-summary")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("lesson-summary-score")).toBeVisible();
    await expect(page.getByTestId("lesson-summary-stars")).toBeVisible();

    // Traversed all five exercise renderers.
    for (const type of [
      "matching",
      "free_text",
      "word_tiles",
      "cloze",
      "picture_choice",
    ]) {
      expect(seen, `exercise type ${type} was rendered`).toContain(type);
    }

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
