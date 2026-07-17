/**
 * Lesson modes (manual test plan gap-fill).
 *
 * #1007 added the Practice / Exam / Timed / Reverse mode toggle on the lesson
 * page; #1027 fixed it being wrongly disabled on a freshly-opened lesson (it
 * must be switchable UNTIL the run is under way, then it locks so the rules
 * can't change mid-run). The session-2 flow covers exercise playthrough but
 * not the mode selector, so this spec pins:
 *
 *   - the toggle is present and every mode is enabled on a fresh lesson
 *     (#1027), with Practice selected by default;
 *   - selecting a mode flips the active (aria-pressed) state.
 *
 * Dexie build, no backend; the bundled lesson set renders offline.
 */

import { expect, test, type Page } from "@playwright/test";

import { ContentPage } from "./pages/ContentPage";
import { mockContent } from "./helpers/mock-content";
import { seedLearner } from "./helpers/setup";

const MODES = ["practice", "exam", "timed", "reverse"] as const;

/** Expand the collapsible lesson-options panel (#1628) that now wraps the
 *  mode toggle. Idempotent: only clicks while the panel is collapsed. */
async function openLessonOptions(page: Page) {
  const toggle = page.getByTestId("lesson-options-toggle");
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(page.getByTestId("lesson-options-body")).toBeVisible();
}

test.describe("Lesson modes", () => {
  test.beforeEach(async ({ page }) => {
    await mockContent(page);
    await seedLearner(page);
  });

  test("the mode toggle is enabled on a fresh lesson (#1027)", async ({
    page,
  }) => {
    const content = new ContentPage(page);
    await content.goto();
    await content.openBundledLesson();
    await openLessonOptions(page);

    await expect(page.getByTestId("lesson-mode-toggle")).toBeVisible();
    // #1027 — every mode is switchable until the run is under way.
    for (const mode of MODES) {
      await expect(page.getByTestId(`lesson-mode-${mode}`)).toBeEnabled();
    }
    // Practice is the default selection.
    await expect(page.getByTestId("lesson-mode-practice")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("selecting a mode flips the active state", async ({ page }) => {
    const content = new ContentPage(page);
    await content.goto();
    await content.openBundledLesson();
    await openLessonOptions(page);

    await page.getByTestId("lesson-mode-exam").click();
    await expect(page.getByTestId("lesson-mode-exam")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("lesson-mode-practice")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
