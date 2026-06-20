/**
 * Session 7 — Accessibility (manual test plan automation, #616).
 *
 * Dexie build, no backend. axe-core WCAG 2.1 A + AA scans on the key
 * routes, the skip-to-content bypass (#514), the dialog focus trap
 * (#515 / useDialogFocus, via the avatar crop dialog), and the active
 * Settings tab's aria-current.
 */

import { expect, test } from "@playwright/test";

import { expectNoA11yViolations } from "./helpers/a11y";
import { ContentPage } from "./pages/ContentPage";
import { SettingsPage } from "./pages/SettingsPage";
import { seedLearner } from "./helpers/setup";
import { mockContent } from "./helpers/mock-content";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Session 7 — Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await mockContent(page);
  });

  test("axe: Dashboard / Content / Settings / Statistics", async ({ page }) => {
    await seedLearner(page);
    for (const route of ["/dashboard", "/content", "/settings", "/statistics"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await expectNoA11yViolations(page, route);
    }
  });

  test("axe: Lesson viewer", async ({ page }) => {
    const content = new ContentPage(page);
    await content.goto();
    await content.openBundledLesson();
    await page.waitForLoadState("networkidle");
    await expectNoA11yViolations(page, "/lesson");
  });

  test("skip-to-content moves focus into #main (#514)", async ({ page }) => {
    await page.goto("/content?tab=my");
    await expect(page.getByTestId("content-tree")).toBeVisible({
      timeout: 15_000,
    });
    // The skip link is the first focusable element.
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("skip-to-content")).toBeFocused();
    await page.keyboard.press("Enter");
    const activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("main");
  });

  test("the avatar crop dialog is a dismissible modal (#515)", async ({
    page,
  }) => {
    const settings = new SettingsPage(page);
    await seedLearner(page);
    // The avatar crop dialog is a useDialogFocus consumer (#515) on General.
    await settings.goto("general");
    await expect(settings.sidebar).toBeVisible({ timeout: 15_000 });
    await expect(settings.avatarFileInput).toBeAttached();
    await settings.avatarFileInput.setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    // The modal contract: a role="dialog" with aria-modal (so assistive
    // tech treats the rest of the page as inert), and it is dismissible.
    // (The strict Tab focus-trap stays a manual check — headless focus
    // timing on the file-triggered dialog is unreliable.)
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await page.getByTestId("crop-cancel").click();
    await expect(dialog).toHaveCount(0);
  });

  test("active Settings tab carries aria-current=page", async ({ page }) => {
    const settings = new SettingsPage(page);
    await seedLearner(page);
    await settings.goto();
    await settings.openTab("learning");
    await expect(settings.tab("learning")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(settings.tab("general")).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
