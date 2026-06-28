/**
 * Matching pair-resolution animation (manual test plan gap-fill, #824/#825).
 *
 * After checking a Matching exercise the learner can press "Auflösen" (Solve)
 * to reveal the correct pairs with one of four effects (slide/color/connect/
 * stack), chosen in Settings > Learning. The reveal REPLACES the interactive
 * grid (no longer editable), and ``prefers-reduced-motion`` drops every
 * animation utility.
 *
 * Since #1218 the post-check My-answers / Solve toggle only appears on a
 * WRONG / partial answer — a fully-correct match shows a success "Continue"
 * (``ExerciseSuccessAdvance``) instead, since there is nothing to "solve".
 * The Solve/resolution slices therefore drive a deliberately-wrong match.
 *
 * Four slices:
 *  1. Settings: the effect select offers exactly the four options + persists.
 *  2. Lesson (wrong answer): the Solve button appears after Check, and
 *     resolving locks the grid (the interactive tiles are gone, the
 *     resolution is shown).
 *  3. Reduced motion (wrong answer): the resolved tiles carry no
 *     ``animate-[...]`` utility.
 *  4. #1218: a fully-correct match shows the success "Continue", not the
 *     My-answers / Solve toggle.
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

/** Drive the mocked lesson to the Matching exercise and check it. Pairs the
 *  match either WRONG (default — leaves the Solve / "Auflösen" toggle on
 *  screen, the post-#1218 path) or fully correct (``correct: true`` — leaves
 *  the success "Continue"). Returns false if no Matching reached. */
async function reachCheckedMatching(
  content: ContentPage,
  lesson: LessonRunner,
  opts: { correct?: boolean } = {},
): Promise<boolean> {
  await content.goto();
  await content.openBundledLesson();
  const reached = await lesson.advanceUntil("matching");
  if (!reached) return false;
  if (opts.correct) {
    await lesson.pairAllMatching();
  } else {
    await lesson.pairAllMatchingIncorrect();
  }
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

  test("the Solve button appears after a wrong Check and locks the grid", async ({
    page,
  }) => {
    await mockContent(page);
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    // A wrong/partial answer keeps the My-answers / Solve toggle (a correct
    // answer would show the #1218 success "Continue" instead).
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

  test("#1218 — a fully-correct match shows the success Continue, not the toggle", async ({
    page,
  }) => {
    await mockContent(page);
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    const reached = await reachCheckedMatching(content, lesson, { correct: true });
    test.skip(!reached, "no matching exercise reached in this lesson");

    // On a fully-correct answer the post-check toggle is replaced by the
    // shared success badge + "Continue" (drives goNext) — the Solve /
    // My-answers toggle is not offered (there is nothing to solve).
    await expect(page.getByTestId("matching-success-advance")).toBeVisible();
    await expect(page.getByTestId("matching-advance")).toBeVisible();
    await expect(page.getByTestId("matching-view-toggle")).toHaveCount(0);
    await expect(page.getByTestId("matching-resolve")).toHaveCount(0);
  });
});
