/**
 * Session 8 — Keyboard shortcuts (manual test plan automation, #616).
 *
 * Dexie build, no backend. Covers the global + navigation shortcuts
 * (``?`` help, Escape, Ctrl/⌘+K search, Ctrl/⌘+, settings, Alt+D/S/C/P),
 * the input-guard (shortcuts disabled while typing), the lesson Enter
 * key, picture-choice number keys, and the matching Ctrl/⌘+Z undo.
 */

import { expect, test } from "@playwright/test";

import { ContentPage } from "./pages/ContentPage";
import { LessonRunner } from "./pages/LessonRunner";
import { OnboardingPage } from "./pages/OnboardingPage";
import { seedLearner } from "./helpers/setup";
import { mockContent } from "./helpers/mock-content";

test.describe("Session 8 — Keyboard shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await mockContent(page);
  });

  test("? toggles the help overlay; Escape closes it", async ({ page }) => {
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({
      timeout: 15_000,
    });
    await page.keyboard.press("?");
    await expect(page.getByTestId("shortcut-help")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("shortcut-help")).toHaveCount(0);
    // Toggle off with a second "?".
    await page.keyboard.press("?");
    await expect(page.getByTestId("shortcut-help")).toBeVisible();
    await page.keyboard.press("?");
    await expect(page.getByTestId("shortcut-help")).toHaveCount(0);
  });

  test("shortcuts are disabled while typing in an input", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.nameInput.click();
    await onboarding.nameInput.press("?");
    // The "?" is typed, not swallowed by the help shortcut.
    await expect(onboarding.nameInput).toHaveValue("?");
    await expect(page.getByTestId("shortcut-help")).toHaveCount(0);
  });

  test("Ctrl/⌘+K focuses the content search", async ({ page }) => {
    const content = new ContentPage(page);
    await content.goto();
    await page.keyboard.press("Control+k");
    await expect(content.searchInput).toBeFocused();
  });

  test("Ctrl/⌘+, opens Settings", async ({ page }) => {
    await seedLearner(page);
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 15_000 });
    // Ensure the document has focus so the global key listener receives
    // the chord, then fire it (retry once if the first press is missed).
    await page.locator("body").click();
    await page.keyboard.press("Control+Comma");
    await page.waitForURL("**/settings", { timeout: 8_000 }).catch(async () => {
      await page.keyboard.press("Control+Comma");
      await page.waitForURL("**/settings", { timeout: 8_000 });
    });
    await expect(page.getByTestId("settings-tabs")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Alt+D / Alt+C / Alt+S / Alt+P navigate", async ({ page }) => {
    await seedLearner(page);
    await page.keyboard.press("Alt+c");
    await page.waitForURL("**/content");
    await page.keyboard.press("Alt+d");
    await page.waitForURL("**/dashboard");
    await page.keyboard.press("Alt+s");
    await page.waitForURL("**/settings");
    await page.keyboard.press("Alt+p");
    await page.waitForURL("**/statistics");
  });

  test("lesson: Enter checks an answered exercise", async ({ page }) => {
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    await content.goto();
    await content.openBundledLesson();
    const reached = await lesson.advanceUntil("free_text");
    test.skip(!reached, "no free-text exercise reached in this lesson");
    await page.getByTestId("free-text-input").fill("Bonjour");
    await page.getByTestId("free-text-input").press("Enter");
    await expect(page.getByTestId("free-text-result")).toBeVisible();
  });

  test("picture-choice: number keys select an option", async ({ page }) => {
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    await content.goto();
    await content.openBundledLesson();
    const reached = await lesson.advanceUntil("picture_choice");
    test.skip(!reached, "no picture-choice exercise reached in this lesson");
    await page.keyboard.press("1");
    // Pressing "1" selects the first choice → the shared Check enables.
    await expect(lesson.check).toBeEnabled();
  });

  test("matching: Ctrl/⌘+Z undoes the last pair", async ({ page }) => {
    const content = new ContentPage(page);
    const lesson = new LessonRunner(page);
    await content.goto();
    await content.openBundledLesson();
    const reached = await lesson.advanceUntil("matching");
    test.skip(!reached, "no matching exercise reached in this lesson");
    await page.getByTestId("matching-left-0").click();
    await page.getByTestId("matching-right-0").click();
    await expect(page.getByTestId("matching-pair-badge-1").first()).toBeVisible();
    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("matching-pair-badge-1")).toHaveCount(0);
  });
});
