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

import { expect, test } from "@playwright/test";

import { ContentPage } from "./pages/ContentPage";
import { mockContent } from "./helpers/mock-content";
import { seedLearner } from "./helpers/setup";

const MODES = ["practice", "exam", "timed", "reverse"] as const;

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
