/**
 * Matching pair-resolution animation (manual test plan gap-fill, #824/#825).
 *
 * After checking a Matching exercise the learner can press "Auflösen" (Solve)
 * to reveal the correct pairs with one of four effects (slide/color/connect/
 * stack), chosen in Settings > Learning. The reveal REPLACES the interactive
 * grid (no longer editable), and ``prefers-reduced-motion`` drops every
 * animation utility.
 *
 * Three slices:
 *  1. Settings: the effect select offers exactly the four options + persists.
 *  2. Lesson: the Solve button appears after Check, and resolving locks the
 *     grid (the interactive tiles are gone, the resolution is shown).
 *  3. Reduced motion: the resolved tiles carry no ``animate-[...]`` utility.
 *
 * Dexie build, no backend, mocked content fixture (its first exercise is a
 * 3-pair Matching).
 */

import { expect, test } from "@playwright/test";

import { ContentPage } from "./pages/ContentPage";
import { LessonRunner } from "./pages/LessonRunner";
import { mockContent } from "./helpers/mock-content";
import { seedLearner } from "./helpers/setup";

/** localStorage key from ``lib/learning/matchingResolvePref.ts``. */
const RESOLVE_EFFECT_KEY = "adaptive-learner.matching.resolve_effect";
const EFFECTS = ["slide", "color", "connect", "stack"] as const;

/** Drive the mocked lesson to the Matching exercise and check it, leaving the
 *  Solve ("Auflösen") button on screen. Returns false if no Matching reached. */
async function reachCheckedMatching(
  content: ContentPage,
  lesson: LessonRunner,
): Promise<boolean> {
  await content.goto();
  await content.openBundledLesson();
  const reached = await lesson.advanceUntil("matching");
  if (!reached) return false;
  await lesson.pairAllMatching();
  await expect(lesson.check).toBeEnabled();
  await lesson.check.click();
  return true;
}

test.describe("Matching resolution (#824/#825)", () => {
  test("Settings offers the four resolve effects and persists the choice", async ({
    page,
  }) => {
    await seedLearner(page);
    await page.goto("/settings?tab=learning");
    const control = page.getByTestId("settings-section-matching-resolve");
    await expect(control).toBeVisible({ timeout: 15_000 });

    const select = page.getByTestId("settings-matching-resolve-effect");
    const values = await select.locator("option").evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value),
    );
    expect(values).toEqual([...EFFECTS]);

    await select.selectOption("stack");
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), RESOLVE_EFFECT_KEY))
      .toBe("stack");
  });

  test("the Solve button appears after Check and locks the grid", async ({
    page,
  }) => {
    await mockContent(page);
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    const reached = await reachCheckedMatching(content, lesson);
    test.skip(!reached, "no matching exercise reached in this lesson");

    // After checking, the Solve button is offered.
    const solve = page.getByTestId("matching-resolve");
    await expect(solve).toBeVisible();
    await solve.click();

    // The reveal replaces the interactive grid: resolution shown, tiles gone.
    await expect(page.getByTestId("matching-resolution")).toBeVisible();
    await expect(page.getByTestId("matching-left-0")).toHaveCount(0);
    // #977 — the Solution/My-answers toggle stays visible so the learner
    // can switch back to their graded answers (it no longer disappears).
    await expect(page.getByTestId("matching-resolve")).toBeVisible();
    await expect(page.getByTestId("matching-my-answers")).toBeVisible();
  });

  test("prefers-reduced-motion drops the resolve animation", async ({ page }) => {
    // Must be set before the exercise mounts (the component reads
    // prefers-reduced-motion once via useMemo).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockContent(page);
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    const reached = await reachCheckedMatching(content, lesson);
    test.skip(!reached, "no matching exercise reached in this lesson");

    await page.getByTestId("matching-resolve").click();
    await expect(page.getByTestId("matching-resolution")).toBeVisible();

    // Default effect is "slide", which would otherwise add an
    // ``animate-[matching-resolve-slide...]`` utility; under reduced motion
    // the resolved tiles carry no animation class.
    const tile = page.getByTestId("matching-resolved-a-0");
    await expect(tile).toBeVisible();
    const cls = (await tile.getAttribute("class")) ?? "";
    expect(cls).not.toContain("animate-[");
  });
});
