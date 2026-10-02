/**
 * Adaptive lesson generation + completion (Phase 61 E2E, journey e).
 *
 * Dexie build, no backend. Creates a learner (element errors are
 * recorded per user, #3236), seeds errors by playing a bundled lesson
 * with wrong answers, then opens the adaptive session for that set.
 * The seed yields a lesson cluster (CLUSTER_MIN = 3), so the
 * rule-based generator builds a personalised lesson, and the journey
 * plays it from its theory page to the scored summary. The empty
 * state is no longer an accepted outcome: without a learner the spec
 * checked that state on every run and never saw an adaptive lesson.
 */

import { expect, test, type Page } from "@playwright/test";
import { currentStepTestId, waitForStepAdvance } from "./_step-flow";
import { createTestUser } from "../helpers/onboarding";

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
      // Pair left-i with right-i. The right testids carry the ORIGINAL
      // pair index, so these pairs are correct: matching steps are not
      // where this seed records its errors.
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
    const beforeStep = await currentStepTestId(page);
    let advanced = false;
    if ((await next.count()) && (await next.isEnabled().catch(() => false))) {
      await next.click();
      advanced = true;
    }
    await waitForStepAdvance(page, advanced ? beforeStep : null);
  }
}

async function playAdaptive(page: Page, maxSteps: number): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    if (await page.getByTestId("adaptive-lesson-summary").count()) break;
    // The adaptive lesson runs in the runner shell's controlled two-phase
    // footer: the shared "Check" (adaptive-lesson-check) grades, then
    // adaptive-lesson-next advances. Theory steps show Next alone.
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
      const n = await page.getByTestId(/^matching-left-\d+$/).count();
      for (let k = 0; k < n; k++) {
        await page.getByTestId(`matching-left-${k}`).click();
        await page.getByTestId(`matching-right-${k}`).click();
      }
    }
    // #3237: the check enables one render after the last answer (the
    // exercise reports "answerable" from an effect, the shell stores it in
    // state). An instant isEnabled() read skipped it, the step did not
    // advance, and the next pass tapped every matching tile again, which
    // undoes pairs by design: 4, 0, 3 of 4 pairs, then a timeout. Wait for
    // each button, and fail on a step that does not advance instead of
    // answering it a second time.
    const check = page.getByTestId("adaptive-lesson-check");
    if (await check.count()) {
      await expect(check).toBeEnabled({ timeout: 5000 });
      await check.click();
    }
    const next = page.getByTestId("adaptive-lesson-next");
    const beforeStep = await currentStepTestId(page);
    await expect(next).toBeEnabled({ timeout: 5000 });
    await next.click();
    await waitForStepAdvance(page, beforeStep);
  }
}

test.describe("Adaptive lesson: generation + completion", () => {
  test("seed errors, then generate + complete the adaptive lesson", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // 0) A learner: element errors are recorded per user, so without one
    //    the route can only ever render its empty state (#3236).
    await createTestUser(page);

    // 1) Download the set + play its first lesson with wrong answers
    //    to record element errors.
    await page.goto("/content?tab=my");
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

    // 2) Open the adaptive session for the set. With a learner and a
    //    lesson cluster the generator builds a lesson; the empty state
    //    here is a failure, not an alternative outcome.
    await page.goto(`/adaptive-lesson/${SET_ID}`);
    await expect(page.getByTestId("adaptive-lesson-page")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("adaptive-lesson-empty")).toHaveCount(0);
    await expect(page.getByTestId("adaptive-transparency")).toBeVisible();

    // 3) #3224: the first screen is the theory page the generator borrows
    //    from the source lesson. The seed answers more than 3 exercises of
    //    lesson 1 wrong, so the analyzer forms a lesson cluster and the
    //    theory step leads. It shows its content with Next alone, never the
    //    dispatcher's "missing its type" placeholder; playAdaptive then
    //    moves past it with Next like any step without an exercise.
    await expect(page.getByTestId("adaptive-lesson-theory-body")).toBeVisible();
    await expect(page.getByTestId("adaptive-lesson-next")).toBeVisible();
    await expect(page.getByTestId("adaptive-lesson-check")).toHaveCount(0);
    await expect(page.getByTestId("lesson-exercise-placeholder-missing")).toHaveCount(0);

    // 4) Play through to the scored summary.
    await playAdaptive(page, 40);
    await expect(page.getByTestId("adaptive-lesson-summary")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("adaptive-summary-score")).toBeVisible();

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
